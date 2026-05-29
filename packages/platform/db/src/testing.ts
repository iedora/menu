import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'

/**
 * One isolated in-memory Postgres per test (or per suite if you want).
 * PGLite gives real Postgres semantics — json, indexes, transactions
 * all work. First call ~1s (WASM init); subsequent calls <100ms.
 *
 * Generic over the consumer's schema. The product owns the schema
 * import and the migrations folder path; this fixture just wires
 * postgres + drizzle + migrator with the same shape every product
 * uses in production (`casing: 'snake_case'`).
 *
 * If the product's migrations create the database schema explicitly
 * (e.g. `CREATE SCHEMA "menu"`), pass `pgSchema` and we'll pre-create
 * it before the migrator runs — PGLite occasionally lags real Postgres
 * on `CREATE SCHEMA` inside the migrator's transaction wrapping.
 */
export interface TestDb<TSchema extends Record<string, unknown>> {
  client: PGlite
  db: PgliteDatabase<TSchema>
  cleanup: () => Promise<void>
}

export interface MakeTestDbOptions {
  /**
   * Absolute path to the migrations folder, OR a path relative to
   * `process.cwd()`. The caller knows where its `drizzle/` lives.
   */
  migrationsFolder: string
  /**
   * Drizzle migrations table name. Default `__drizzle_migrations`.
   */
  migrationsTable?: string
  /**
   * Postgres schema name the migrations live in (matches
   * `drizzle.config.ts::migrations.schema`). Pre-created before the
   * migrator runs.
   */
  pgSchema?: string
}

export async function makeTestDb<TSchema extends Record<string, unknown>>(
  schema: TSchema,
  opts: MakeTestDbOptions,
): Promise<TestDb<TSchema>> {
  const client = new PGlite()
  const db = drizzle(client, { schema, casing: 'snake_case' }) as PgliteDatabase<TSchema>

  if (opts.pgSchema) {
    await client.exec(`CREATE SCHEMA IF NOT EXISTS "${opts.pgSchema}";`)
  }

  const migrationsFolder = path.isAbsolute(opts.migrationsFolder)
    ? opts.migrationsFolder
    : path.join(process.cwd(), opts.migrationsFolder)

  await migrate(db, {
    migrationsFolder,
    migrationsTable: opts.migrationsTable ?? '__drizzle_migrations',
    migrationsSchema: opts.pgSchema,
  })

  return {
    client,
    db,
    cleanup: async () => {
      await client.close()
    },
  }
}
