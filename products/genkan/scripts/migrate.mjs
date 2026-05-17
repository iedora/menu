// Applies Drizzle migrations in production without drizzle-kit at runtime.
// Runs inside the production container via:  node scripts/migrate.mjs
//
// Genkan and menu SHARE the same Postgres SERVER (the `meta-menu-postgres`
// accessory) but each uses its own DATABASE. genkan owns the `genkan`
// database; menu owns `metamenu`. Postgres prevents cross-database queries
// at the server level, so the "no coupling" guarantee holds despite the
// shared process.
//
// On first boot the `genkan` database doesn't exist yet — we connect to
// the admin `postgres` database, CREATE it, then continue normally.

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

// pg advisory lock guards against parallel migrates. CRC32 of "genkan-migrate".
const LOCK_KEY = 411073872

/**
 * Parse a postgres URL and return a sibling URL pointing at the admin
 * `postgres` database on the same server — for the one-shot CREATE DATABASE.
 */
function adminUrlFor(connStr) {
  const u = new URL(connStr)
  u.pathname = '/postgres'
  return u.toString()
}

/** Extract the target database name from a postgres URL. */
function dbNameFromUrl(connStr) {
  const u = new URL(connStr)
  return decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres'
}

const targetDb = dbNameFromUrl(url)

// Step 1 — ensure the target database exists. Connect to the admin DB,
// check pg_database, CREATE if missing. Single-shot connection.
{
  const adminSql = postgres(adminUrlFor(url), { max: 1, onnotice: () => {} })
  try {
    const rows = await adminSql`SELECT 1 FROM pg_database WHERE datname = ${targetDb}`
    if (rows.length === 0) {
      console.log(`Database "${targetDb}" not found — creating ...`)
      // CREATE DATABASE doesn't run inside a transaction; postgres.js sends
      // it as a top-level statement. Tag-literal injection is safe because
      // pg_quote_ident escapes the identifier.
      await adminSql.unsafe(`CREATE DATABASE "${targetDb.replace(/"/g, '""')}"`)
      console.log(`Created database "${targetDb}".`)
    } else {
      console.log(`Database "${targetDb}" already exists.`)
    }
  } finally {
    await adminSql.end()
  }
}

// Step 2 — connect to the target database, hold an advisory lock, migrate.
const sql = postgres(url, { max: 1 })
const db = drizzle(sql)

try {
  console.log(`Acquiring advisory lock (${LOCK_KEY})...`)
  await sql`SELECT pg_advisory_lock(${LOCK_KEY})`

  console.log('Applying migrations from ./drizzle ...')
  await migrate(db, {
    migrationsFolder: './drizzle',
    migrationsTable: '__drizzle_migrations',
  })
  console.log('Migrations applied successfully.')

  // Bootstrap first-party OAuth clients. Genkan's oauth-provider plugin
  // reads client rows from the `oauth_client` table; pre-trusted clients
  // (skip_consent=true) are pinned by client_id via `cachedTrustedClients`
  // in the auth config. We upsert the rows here so a fresh deploy comes
  // up with menu (and any sibling product) ready to authorize without a
  // manual step.
  //
  // TRUSTED_CLIENTS format: one line per client,
  //   `client_id|client_secret|redirect_uri_1,redirect_uri_2`
  const raw = process.env.TRUSTED_CLIENTS ?? ''
  const entries = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (entries.length === 0) {
    console.log('No TRUSTED_CLIENTS to seed.')
  } else {
    for (const line of entries) {
      const [clientId, clientSecret, redirectUris] = line.split('|')
      if (!clientId || !clientSecret || !redirectUris) {
        console.warn(`Skipping malformed TRUSTED_CLIENTS entry: ${line}`)
        continue
      }
      const uris = redirectUris.split(',').map((u) => u.trim())
      // Better Auth hashes secrets with SHA-256 + base64url (no padding)
      // before storing. Match the algorithm so the runtime check passes.
      const { createHash } = await import('node:crypto')
      const hashed = createHash('sha256')
        .update(clientSecret, 'utf8')
        .digest('base64url')
      // Stable id derived from the client_id so re-running migrate.mjs is
      // idempotent. The clientId column is unique.
      const id = `tc_${clientId}`
      await sql`
        INSERT INTO oauth_client (
          id, client_id, client_secret, name, redirect_uris,
          scopes, skip_consent, disabled, public, require_pkce,
          token_endpoint_auth_method, grant_types, response_types,
          subject_type, type, created_at, updated_at
        ) VALUES (
          ${id}, ${clientId}, ${hashed}, ${clientId}, ${uris},
          ${['openid','profile','email','offline_access','menu','org:read','org:admin']},
          true, false, false, true,
          'client_secret_basic',
          ${['authorization_code','refresh_token']},
          ${['code']},
          'public', 'web', NOW(), NOW()
        )
        ON CONFLICT (client_id) DO UPDATE SET
          client_secret = EXCLUDED.client_secret,
          redirect_uris = EXCLUDED.redirect_uris,
          skip_consent  = EXCLUDED.skip_consent,
          updated_at    = NOW()
      `
      console.log(`Seeded trusted client: ${clientId}`)
    }
  }
} catch (err) {
  console.error('Migration failed:', err)
  process.exitCode = 1
} finally {
  try { await sql`SELECT pg_advisory_unlock(${LOCK_KEY})` } catch {}
  await sql.end()
}
