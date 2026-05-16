import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/shared/db/schema.ts',
  out: './drizzle',
  // Genkan owns the auth tables; menu also declares them today for read access
  // during the transition. Don't generate fresh CREATE TABLEs until the menu
  // copies are removed in the cut-over migration.
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  casing: 'snake_case',
})
