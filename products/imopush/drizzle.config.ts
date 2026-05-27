import { defineConfig } from 'drizzle-kit'

/**
 * imopush owns its own Postgres database (`imopush`). Drizzle migrations
 * track in a dedicated `__drizzle_migrations` table under the `imopush`
 * pg-schema so other products' migrators don't collide.
 */
export default defineConfig({
  schema: './src/shared/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.IMOPUSH_DATABASE_URL!,
  },
  casing: 'snake_case',
  migrations: {
    table: '__drizzle_migrations',
    schema: 'imopush',
  },
})
