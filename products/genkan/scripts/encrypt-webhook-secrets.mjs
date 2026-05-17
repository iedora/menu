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
// Self-contained crypto
// --------------------
// The script duplicates the HKDF + AES-256-GCM envelope from
// `@iedora/identity/src/secret-storage.ts` instead of importing it. Why:
// Next's standalone tracer follows imports from the route graph, not from
// /scripts/*.mjs — packages used only by scripts aren't bundled. Inlining
// keeps the migration script dependency-free at runtime (only `postgres`)
// while the canonical library implementation handles the runtime path
// inside the Next app. The envelope format is stable across both:
//
//   iedora/v1:<base64url(iv || ciphertext || tag)>
//
// 12-byte IV (NIST SP 800-38D recommended for GCM), 16-byte tag.
// HKDF: salt = "iedora/webhook-secret-v1", info = "encrypt", 32-byte output.

import postgres from 'postgres'
import { createHash, createHmac, createCipheriv, randomBytes } from 'node:crypto'

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

const SALT = Buffer.from('iedora/webhook-secret-v1', 'utf8')
const INFO = Buffer.from('encrypt', 'utf8')
const ENVELOPE_PREFIX = 'iedora/v1:'

/** Same key-tolerance rules as @iedora/identity's createHkdfEncryptor:
 *  try base64 first, fall back to UTF-8 bytes, require ≥ 32 bytes either way. */
function masterKeyBytes(raw) {
  try {
    const b = Buffer.from(raw, 'base64')
    if (b.length >= 32) return b
  } catch { /* fall through */ }
  const u = Buffer.from(raw, 'utf8')
  if (u.length >= 32) return u
  throw new Error('BETTER_AUTH_SECRET decodes to fewer than 32 bytes (needed for AES-256)')
}

/** HKDF-SHA256, RFC 5869. Node 22's webcrypto has it but the synchronous
 *  HMAC path is plenty fast and avoids the async-in-CLI dance. */
function hkdfSha256(ikm, salt, info, length) {
  const prk = createHmac('sha256', salt).update(ikm).digest()
  const blocks = []
  let prev = Buffer.alloc(0)
  for (let i = 1; blocks.length * 32 < length; i++) {
    const h = createHmac('sha256', prk)
    h.update(prev).update(info).update(Buffer.from([i]))
    prev = h.digest()
    blocks.push(prev)
  }
  return Buffer.concat(blocks).subarray(0, length)
}

const KEY = hkdfSha256(masterKeyBytes(process.env.BETTER_AUTH_SECRET), SALT, INFO, 32)

function encrypt(plaintext) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ENVELOPE_PREFIX + Buffer.concat([iv, ct, tag]).toString('base64url')
}

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
    const wrapped = encrypt(String(row.secret))
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
