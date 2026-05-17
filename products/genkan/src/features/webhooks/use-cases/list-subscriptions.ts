import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { secretStorage } from '@iedora/identity'
import { db } from '@/shared/db/client'
import { webhookSubscription } from '@/shared/db/schema'

export type WebhookSubscriptionRow = {
  id: string
  name: string | null
  url: string
  /**
   * The plaintext HMAC secret, decrypted from storage. Callers MUST treat
   * this as sensitive: never log it, never put it in an audit payload, and
   * only ship it to a client when the request is from an authenticated
   * admin (the reveal-secret affordance on the detail page).
   *
   * `null` means a row exists but its stored ciphertext is unreadable
   * (e.g. corrupted row, KEK mismatch). The page surfaces that explicitly
   * rather than crashing.
   */
  secret: string | null
  events: string[] | null
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

let warnedPlaintext = false

function readSecret(stored: string): string | null {
  try {
    if (secretStorage.isEncrypted(stored)) return secretStorage.decrypt(stored)
    if (!warnedPlaintext) {
      warnedPlaintext = true
      console.warn(
        '[webhooks] at least one subscription row stores its secret in plaintext — run scripts/encrypt-webhook-secrets.mjs to migrate.',
      )
    }
    return stored
  } catch (e) {
    console.error('[webhooks] failed to decrypt subscription secret', e)
    return null
  }
}

export async function listAdminSubscriptions(): Promise<WebhookSubscriptionRow[]> {
  const rows = await db
    .select()
    .from(webhookSubscription)
    .orderBy(desc(webhookSubscription.createdAt))
    .limit(500)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    secret: readSecret(r.secret),
    events: r.events ?? null,
    enabled: r.enabled,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

export async function getSubscriptionById(
  id: string,
): Promise<WebhookSubscriptionRow | null> {
  const [row] = await db
    .select()
    .from(webhookSubscription)
    .where(eq(webhookSubscription.id, id))
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    secret: readSecret(row.secret),
    events: row.events ?? null,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
