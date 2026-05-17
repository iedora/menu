// Aplica migrations Drizzle em produção sem precisar de drizzle-kit no runtime.
// Corre no container produção via:  node scripts/migrate.mjs
//
// Genkan e menu partilham o mesmo Postgres (one DATABASE_URL); cada app
// migra o seu próprio schema:
//   - genkan → `auth.*`
//   - menu   → `menu.*` (e também `CREATE SCHEMA IF NOT EXISTS auth`)
// A ordem de aplicação não importa porque ambas usam IF NOT EXISTS para
// o schema `auth`.

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

// pg advisory lock garante que dois deploys paralelos não migram em duplicado.
// O valor é arbitrário mas tem de ser estável e único — crc32 de "genkan-migrate".
const LOCK_KEY = 411073872

const sql = postgres(url, { max: 1 })
const db = drizzle(sql)

try {
  console.log(`Acquiring advisory lock (${LOCK_KEY})...`)
  await sql`SELECT pg_advisory_lock(${LOCK_KEY})`

  console.log('Applying migrations from ./drizzle ...')
  // Per-product tracker — see drizzle.config.ts. Both apps share the same
  // database; without separate trackers the migrator silently skips
  // migrations whose `when` is older than the latest-applied row.
  await migrate(db, {
    migrationsFolder: './drizzle',
    migrationsTable: '__drizzle_migrations',
    migrationsSchema: 'auth',
  })
  console.log('Migrations applied successfully.')
} catch (err) {
  console.error('Migration failed:', err)
  process.exitCode = 1
} finally {
  try { await sql`SELECT pg_advisory_unlock(${LOCK_KEY})` } catch {}
  await sql.end()
}
