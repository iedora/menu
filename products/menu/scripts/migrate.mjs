// Applies Drizzle migrations in production without drizzle-kit at runtime.
// Runs inside the container via:  node scripts/migrate.mjs
//
// The `menu` database is created on first boot of the shared infra-postgres
// accessory by infra/postgres/init.sql (CREATE DATABASE menu); the runtime
// here only needs to apply Drizzle migrations.
//
// pg_advisory_lock guards against two replicas racing on `migrate()` —
// Drizzle still has no built-in migration lock (see drizzle-orm#874).
// The literal "meta-menu-migrate" feeds the crc32 → keep stable across
// renames so the key doesn't shift between deploys.

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const LOCK_KEY = 727072073 // crc32 of "meta-menu-migrate"

const sql = postgres(url, { max: 1 })
const db = drizzle(sql)

try {
  await sql`SELECT pg_advisory_lock(${LOCK_KEY})`
  // Per-product tracker — see drizzle.config.ts. Without this, menu and
  // genkan would write into the same `drizzle.__drizzle_migrations` and
  // shadow each other (the migrator only applies entries newer than
  // max(created_at)).
  await migrate(db, {
    migrationsFolder: './drizzle',
    migrationsTable: '__drizzle_migrations',
    migrationsSchema: 'menu',
  })
  console.log('Migrations applied.')
} catch (err) {
  console.error('Migration failed:', err)
  process.exitCode = 1
} finally {
  try { await sql`SELECT pg_advisory_unlock(${LOCK_KEY})` } catch {}
  await sql.end()
}
