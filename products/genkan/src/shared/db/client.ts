import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/shared/env'
import * as schema from './schema'

type DbClient = ReturnType<typeof postgres>

const globalForDb = globalThis as unknown as {
  conn?: DbClient
}

const conn: DbClient =
  globalForDb.conn ??
  postgres(env.DATABASE_URL, {
    max: 10,
    prepare: false,
  })

if (env.NODE_ENV !== 'production') {
  globalForDb.conn = conn
}

export const db = drizzle(conn, { schema, casing: 'snake_case' })
export type DB = typeof db

export async function closeDb(opts: { timeout?: number } = {}): Promise<void> {
  await conn.end({ timeout: opts.timeout ?? 5 })
  if (globalForDb.conn === conn) {
    globalForDb.conn = undefined
  }
}
