import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/shared/db/schema.ts',
  out: './drizzle',
  // Genkan owns the `auth.*` tables; menu redeclares them in its own schema
  // file (same shape, same Postgres schema annotation) so its Better Auth
  // instance can read/write the shared identity tables. Both apps run their
  // own migrations against the same database; the auth schema is emitted with
  // `CREATE SCHEMA IF NOT EXISTS` so order doesn't matter.
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  casing: 'snake_case',
  // Per-product migrations tracker so menu and genkan don't shadow each
  // other in the shared database. Genkan's lives in `auth.__drizzle_migrations`;
  // menu's lives in `menu.__drizzle_migrations`.
  migrations: {
    table: '__drizzle_migrations',
    schema: 'auth',
  },
})
