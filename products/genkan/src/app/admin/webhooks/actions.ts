'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { secretStorage } from '@iedora/identity'
import { requireAdmin } from '@/features/admin'
import { requireFreshSession } from '@/features/auth'
import { emit } from '@/features/webhooks'
import { db } from '@/shared/db/client'
import { webhookSubscription } from '@/shared/db/schema'
import { recordAdminEvent } from '../_lib/audit'
import { KNOWN_IDENTITY_EVENTS } from './_events'

type Result = { ok: true } | { ok: false; error: string }
type RegisterResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

function toMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object') {
    const obj = e as { message?: unknown }
    if (typeof obj.message === 'string') return obj.message
  }
  return fallback
}

function generateId(): string {
  return `whs_${randomBytes(12).toString('hex')}`
}

function generateSecret(): string {
  // 32 bytes = 64 hex chars — far more entropy than HMAC-SHA256 needs,
  // but a uniform sized secret is easier to validate by sight.
  return randomBytes(32).toString('hex')
}

function parseEvents(formData: FormData): string[] | null {
  const all = formData.get('events_all')
  if (all === 'on') return null
  const picked = formData
    .getAll('event')
    .map((v) => String(v))
    .filter((v) =>
      (KNOWN_IDENTITY_EVENTS as readonly string[]).includes(v),
    )
  return picked
}

export async function registerSubscriptionAction(
  formData: FormData,
): Promise<RegisterResult> {
  const adminSession = await requireAdmin()
  const name = String(formData.get('name') ?? '').trim() || null
  const url = String(formData.get('url') ?? '').trim()
  const events = parseEvents(formData)

  if (!url) return { ok: false, error: 'URL is required.' }
  try {
    const u = new URL(url)
    if (!u.protocol.startsWith('http')) {
      return { ok: false, error: 'URL must be http(s).' }
    }
  } catch {
    return { ok: false, error: 'URL is not a valid URL.' }
  }
  if (events !== null && events.length === 0) {
    return {
      ok: false,
      error: 'Pick at least one event, or check "All events".',
    }
  }

  const id = generateId()
  // Encrypt the freshly-generated secret before persisting. The plaintext
  // itself never lands on disk; the reveal-secret affordance reads back
  // through `secretStorage.decrypt` in `getSubscriptionById`.
  const secret = generateSecret()
  try {
    await db.insert(webhookSubscription).values({
      id,
      name,
      url,
      secret: secretStorage.encrypt(secret),
      events,
      enabled: true,
    })
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Could not create subscription.') }
  }
  // Record URL + events but NEVER the HMAC secret — same audit-payload
  // discipline as `app.register` (no secrets in the audit table).
  const audit = await recordAdminEvent(
    {
      action: 'webhook.register',
      targetId: id,
      payload: { url, events },
    },
    adminSession,
  )
  if (!audit.ok) return { ok: false, error: audit.error }
  revalidatePath('/admin/webhooks')
  return { ok: true, id }
}

export async function updateSubscriptionAction(
  id: string,
  formData: FormData,
): Promise<Result> {
  const adminSession = await requireAdmin()
  await requireFreshSession({ returnTo: `/admin/webhooks/${id}` })
  const name = String(formData.get('name') ?? '').trim() || null
  const url = String(formData.get('url') ?? '').trim()
  const enabled = formData.get('enabled') === 'on'
  const events = parseEvents(formData)

  if (!url) return { ok: false, error: 'URL is required.' }
  try {
    const u = new URL(url)
    if (!u.protocol.startsWith('http')) {
      return { ok: false, error: 'URL must be http(s).' }
    }
  } catch {
    return { ok: false, error: 'URL is not a valid URL.' }
  }
  if (events !== null && events.length === 0) {
    return {
      ok: false,
      error: 'Pick at least one event, or check "All events".',
    }
  }

  // Snapshot the pre-update row so the audit `changed` payload only lists
  // columns the operator actually moved.
  const [prev] = await db
    .select({
      name: webhookSubscription.name,
      url: webhookSubscription.url,
      events: webhookSubscription.events,
      enabled: webhookSubscription.enabled,
    })
    .from(webhookSubscription)
    .where(eq(webhookSubscription.id, id))
    .limit(1)

  try {
    await db
      .update(webhookSubscription)
      .set({
        name,
        url,
        events,
        enabled,
        updatedAt: new Date(),
      })
      .where(eq(webhookSubscription.id, id))
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Could not update subscription.') }
  }
  const changed: string[] = []
  if (prev) {
    if ((prev.name ?? null) !== (name ?? null)) changed.push('name')
    if (prev.url !== url) changed.push('url')
    if (!arrayShallowEq(prev.events ?? null, events)) changed.push('events')
    if (prev.enabled !== enabled) changed.push('enabled')
  }
  if (changed.length > 0) {
    const audit = await recordAdminEvent(
      {
        action: 'webhook.update',
        targetId: id,
        payload: { changed },
      },
      adminSession,
    )
    if (!audit.ok) return audit
  }
  revalidatePath(`/admin/webhooks/${id}`)
  revalidatePath('/admin/webhooks')
  return { ok: true }
}

export async function deleteSubscriptionAction(
  id: string,
): Promise<Result> {
  const adminSession = await requireAdmin()
  await requireFreshSession({ returnTo: `/admin/webhooks/${id}` })
  try {
    await db
      .delete(webhookSubscription)
      .where(eq(webhookSubscription.id, id))
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Could not delete subscription.') }
  }
  const audit = await recordAdminEvent(
    { action: 'webhook.delete', targetId: id },
    adminSession,
  )
  if (!audit.ok) return audit
  revalidatePath('/admin/webhooks')
  redirect('/admin/webhooks')
}

function arrayShallowEq(
  a: string[] | null,
  b: string[] | null,
): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

/**
 * Fire a synthetic `user.role_changed` event so the operator can verify
 * the subscriber actually accepts deliveries. Useful right after adding
 * a new subscription. The event hits ALL enabled subscribers — not just
 * the one whose page you're on — since that's what the sender does in
 * production.
 */
export async function sendTestEventAction(): Promise<Result> {
  await requireAdmin()
  try {
    await emit({
      event: 'user.role_changed',
      payload: { user_id: '__test__', role: 'admin' },
    })
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Test emit failed.') }
  }
  return { ok: true }
}
