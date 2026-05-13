// Aplica migrations Drizzle em produção sem precisar de drizzle-kit no runtime.
// Corre no container produção via:  node scripts/migrate.mjs
//
// O `lib/db` da app já importa `drizzle-orm/postgres-js`, portanto o migrator
// vai no bundle standalone do Next.

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sql = postgres(url, { max: 1 })
const db = drizzle(sql)

try {
  console.log('Applying migrations from ./drizzle ...')
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migrations applied successfully.')
} catch (err) {
  console.error('Migration failed:', err)
  process.exitCode = 1
} finally {
  await sql.end()
}
