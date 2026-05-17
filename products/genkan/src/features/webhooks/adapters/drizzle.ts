import 'server-only'
import { eq } from 'drizzle-orm'
import { secretStorage, type WebhookSubscription } from '@iedora/identity'
import { db } from '@/shared/db/client'
import { webhookSubscription } from '@/shared/db/schema'

/**
 * Drizzle-backed implementation of `@iedora/identity`'s subscription port.
 * Loaded by the singleton in `sender.ts` once per process.
 *
 * The cast from `string[]` → `IdentityEventName[]` is deliberately loose
 * — admin-UI input is the trust boundary, and the sender's filter is a
 * plain string-equality check anyway. If a row carries a now-removed
 * event tag the filter silently won't match, which is the desired
 * fail-soft behavior.
 *
 * Secrets are stored encrypted as `iedora/v1:…` envelopes (see
 * `@iedora/identity/secret-storage`). We decrypt here, in the adapter,
 * so the rest of the sender stays oblivious to the storage format. Rows
 * pre-dating the encryption rollout still carry plaintext — those pass
 * through unchanged and emit a one-time warning per process so the
 * leftover is visible without flooding logs.
 */
let warnedPlaintext = false

function readSecret(stored: string): string {
  if (secretStorage.isEncrypted(stored)) return secretStorage.decrypt(stored)
  if (!warnedPlaintext) {
    warnedPlaintext = true
    console.warn(
      '[webhooks] at least one subscription row stores its secret in plaintext — run scripts/encrypt-webhook-secrets.mjs to migrate.',
    )
  }
  return stored
}

export async function listSubscriptions(): Promise<WebhookSubscription[]> {
  const rows = await db
    .select({
      url: webhookSubscription.url,
      secret: webhookSubscription.secret,
      events: webhookSubscription.events,
    })
    .from(webhookSubscription)
    .where(eq(webhookSubscription.enabled, true))

  return rows.map((r) => ({
    url: r.url,
    secret: readSecret(r.secret),
    events: r.events
      ? (r.events as WebhookSubscription['events'])
      : undefined,
  }))
}
