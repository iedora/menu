/**
 * Integration test — exercises the restaurant-identity slice against a
 * real Postgres (testcontainers, booted by `tests/integration/global-setup.ts`).
 *
 * Pattern (canonical for `*.integration.test.ts`):
 *   1. globalSetup booted Postgres + ran menu migrations, set
 *      `MENU_DATABASE_URL` on `process.env`.
 *   2. Each test opens a savepoint via `withTransaction`, asserts inside
 *      it, and rolls back — no per-test cleanup, no leakage.
 *
 * If you need MinIO, the globalSetup already exposes it via S3_* env
 * vars; pull the storage adapter the same way.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { withTransaction } from '@iedora/testing-integration/transaction'

let sql: postgres.Sql

beforeAll(() => {
  const url = process.env.MENU_DATABASE_URL
  if (!url) throw new Error('MENU_DATABASE_URL missing — globalSetup did not run?')
  sql = postgres(url, { max: 4 })
})

afterAll(async () => {
  await sql.end({ timeout: 5 })
})

describe('restaurant-identity (integration)', () => {
  it('persists a restaurant row and reads it back inside a savepoint', async () => {
    const tenantId = `tnt-${crypto.randomUUID().slice(0, 8)}`
    const slug = `int-${crypto.randomUUID().slice(0, 8)}`

    await withTransaction(sql, async (tx) => {
      const id = crypto.randomUUID()
      await tx`
        INSERT INTO menu.restaurant (id, tenant_id, name, slug, default_language, supported_languages)
        VALUES (${id}, ${tenantId}, 'O Bom Garfo', ${slug}, 'pt', '["pt"]'::jsonb)
      `
      const rows = await tx<{ name: string; tenant_id: string }[]>`
        SELECT name, tenant_id FROM menu.restaurant WHERE slug = ${slug}
      `
      expect(rows).toHaveLength(1)
      expect(rows[0]?.name).toBe('O Bom Garfo')
      expect(rows[0]?.tenant_id).toBe(tenantId)
    })

    // Savepoint rolled back — the row must not be visible outside the tx.
    const after = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM menu.restaurant WHERE slug = ${slug}
    `
    expect(after[0]?.count).toBe(0)
  })
})
