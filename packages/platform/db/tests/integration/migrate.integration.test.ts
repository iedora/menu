import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { bootPostgres, type PostgresHandle } from '@iedora/testing-integration'
import { runMigrations } from '../../src/migrate.mjs'

/**
 * Guards the `MIGRATE_SKIP_DB_CREATE` contract that the prod deploy
 * relies on (the Authelia pattern: iedora-infra provisions the database
 * out-of-band, the app's migrator only applies schema as a
 * least-privilege role and must NOT attempt CREATE DATABASE).
 *
 * Three cases against a real Postgres:
 *   1. flag unset       → migrator creates the database on demand (dev/CI).
 *   2. flag=1, no db     → migrator does NOT create it; migrate fails and
 *                          the database stays absent.
 *   3. flag=1, db exists → migrations apply cleanly (the prod happy path).
 */

const FIXTURE_FOLDER = fileURLToPath(
  new URL('./fixtures/drizzle', import.meta.url),
)

let pg: PostgresHandle
let admin: postgres.Sql

/** Connection string pointing at a named database on the booted server. */
function urlFor(name: string): string {
  const u = new URL(pg.uri)
  u.pathname = `/${name}`
  return u.toString()
}

async function databaseExists(name: string): Promise<boolean> {
  const rows = await admin<{ one: number }[]>`
    SELECT 1 AS one FROM pg_database WHERE datname = ${name}
  `
  return rows.length > 0
}

/** True if the fixture migration's `widget` table landed in the target db. */
async function widgetTableExists(name: string): Promise<boolean> {
  const sql = postgres(urlFor(name), { max: 1 })
  try {
    const rows = await sql<{ exists: boolean }[]>`
      SELECT to_regclass('public.widget') IS NOT NULL AS exists
    `
    return rows[0]?.exists ?? false
  } finally {
    await sql.end({ timeout: 5 })
  }
}

let counter = 0
/** A database name guaranteed not to pre-exist (drops a stale reuse leftover). */
async function freshDbName(): Promise<string> {
  const name = `migtest_${process.pid}_${counter++}`
  await admin.unsafe(`DROP DATABASE IF EXISTS "${name}"`)
  return name
}

beforeAll(async () => {
  pg = await bootPostgres()
  admin = postgres(pg.uri, { max: 1, onnotice: () => {} })
})

afterAll(async () => {
  await admin?.end({ timeout: 5 })
  await pg?.stop()
})

afterEach(() => {
  delete process.env.MIGRATE_SKIP_DB_CREATE
})

describe('runMigrations + MIGRATE_SKIP_DB_CREATE', () => {
  it('creates the database on demand when the flag is unset', async () => {
    const db = await freshDbName()
    expect(await databaseExists(db)).toBe(false)

    await runMigrations({ url: urlFor(db), folder: FIXTURE_FOLDER, tag: 'fx' })

    expect(await databaseExists(db)).toBe(true)
    expect(await widgetTableExists(db)).toBe(true)
  })

  it('does NOT create the database when the flag is set and it is absent', async () => {
    const db = await freshDbName()
    process.env.MIGRATE_SKIP_DB_CREATE = '1'

    // migrate() connects lazily to a database that does not exist → throws.
    await expect(
      runMigrations({ url: urlFor(db), folder: FIXTURE_FOLDER, tag: 'fx' }),
    ).rejects.toThrow()

    // The migrator must not have provisioned it behind ops' back.
    expect(await databaseExists(db)).toBe(false)
  })

  it('applies migrations when the flag is set and ops pre-provisioned the db', async () => {
    const db = await freshDbName()
    await pg.createDatabase(db) // stands in for the iedora-infra provisioner
    process.env.MIGRATE_SKIP_DB_CREATE = '1'
    expect(await databaseExists(db)).toBe(true)

    await runMigrations({ url: urlFor(db), folder: FIXTURE_FOLDER, tag: 'fx' })

    expect(await widgetTableExists(db)).toBe(true)
  })
})
