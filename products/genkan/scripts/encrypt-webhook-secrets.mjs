// One-shot migration: encrypt every plaintext `webhook_subscription.secret`
// in place. Idempotent — already-encrypted rows (prefixed `iedora/`) are
// skipped. Safe to run repeatedly.
//
// Run in production:
//
//   cd products/genkan/infra
//   bin/with-secrets bash -c '
//     cd kamal && kamal app exec --reuse \
//       "node scripts/encrypt-webhook-secrets.mjs"
//   '
//
// Run locally (against the dev container) by exporting DATABASE_URL +
// BETTER_AUTH_SECRET first, then `bun scripts/encrypt-webhook-secrets.mjs`.
//
// The pre-flight check (BETTER_AUTH_SECRET ≥ 32 bytes) lives in the
// `@iedora/identity` encryptor itself; we'll fail fast at module construction
// if either var is missing or too short.

import postgres from 'postgres'
import { createHkdfEncryptor } from '@iedora/identity'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}
if (!process.env.BETTER_AUTH_SECRET) {
  console.error('BETTER_AUTH_SECRET is not set — encryptor needs it')
  process.exit(1)
}

// pg advisory lock guards against parallel runs (CRC32 of
// "genkan-encrypt-webhook-secrets"). Different lock key from migrate.mjs so
// the two can interleave without deadlocking.
const LOCK_KEY = 873195204

const encryptor = createHkdfEncryptor()
const sql = postgres(url, { max: 1 })

let acquired = false
try {
  console.log(`Acquiring advisory lock (${LOCK_KEY})...`)
  await sql`SELECT pg_advisory_lock(${LOCK_KEY})`
  acquired = true

  const rows = await sql`
    SELECT id, secret FROM webhook_subscription
  `
  let encrypted = 0
  let skipped = 0
  for (const row of rows) {
    if (typeof row.secret === 'string' && row.secret.startsWith('iedora/')) {
      skipped++
      continue
    }
    const wrapped = encryptor.encrypt(String(row.secret))
    // Each row gets its own UPDATE inside an implicit single-statement
    // transaction; the table is small and the script is operator-run, so
    // we don't bother with a batched-CTE rewrite.
    await sql`
      UPDATE webhook_subscription
      SET secret = ${wrapped}, updated_at = NOW()
      WHERE id = ${row.id}
    `
    encrypted++
  }
  console.log(
    `Encrypted ${encrypted} row${encrypted === 1 ? '' : 's'}. ` +
      `Skipped ${skipped} already-encrypted row${skipped === 1 ? '' : 's'}.`,
  )
} catch (err) {
  console.error('Encrypt-webhook-secrets failed:', err)
  process.exitCode = 1
} finally {
  if (acquired) {
    try { await sql`SELECT pg_advisory_unlock(${LOCK_KEY})` } catch {}
  }
  await sql.end()
}
