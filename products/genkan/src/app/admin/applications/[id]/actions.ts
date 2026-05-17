'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/features/admin'
import { requireFreshSession } from '@/features/auth'
import { db } from '@/shared/db/client'
import { oauthClient } from '@/shared/db/schema'
import { recordAdminEvent } from '../../_lib/audit'

type Result = { ok: true } | { ok: false; error: string }

function toMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object') {
    const obj = e as { message?: unknown }
    if (typeof obj.message === 'string') return obj.message
  }
  return fallback
}

function splitLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

export async function updateApplicationAction(
  internalId: string,
  formData: FormData,
): Promise<Result> {
  const adminSession = await requireAdmin()
  await requireFreshSession({ returnTo: `/admin/applications/${internalId}` })
  const name = String(formData.get('client_name') ?? '').trim()
  const redirectUris = splitLines(
    String(formData.get('redirect_uris') ?? ''),
  )
  const scopes = formData
    .getAll('scope')
    .map((s) => String(s))
    .filter(Boolean)

  if (!name) return { ok: false, error: 'Name is required.' }
  if (redirectUris.length === 0) {
    return { ok: false, error: 'At least one redirect URI is required.' }
  }
  for (const uri of redirectUris) {
    try {
      const u = new URL(uri)
      if (!u.protocol.startsWith('http')) {
        return { ok: false, error: `Invalid redirect URI: ${uri}` }
      }
    } catch {
      return { ok: false, error: `Invalid redirect URI: ${uri}` }
    }
  }

  // Snapshot the row pre-update so the audit `changed` list reflects only
  // the columns the operator actually modified.
  const [prev] = await db
    .select({
      name: oauthClient.name,
      redirectUris: oauthClient.redirectUris,
      scopes: oauthClient.scopes,
    })
    .from(oauthClient)
    .where(eq(oauthClient.id, internalId))
    .limit(1)

  try {
    await db
      .update(oauthClient)
      .set({
        name,
        redirectUris,
        scopes: scopes.length > 0 ? scopes : null,
        updatedAt: new Date(),
      })
      .where(eq(oauthClient.id, internalId))
  } catch (e) {
    return {
      ok: false,
      error: toMessage(e, 'Could not update application.'),
    }
  }
  const changed: string[] = []
  if (prev) {
    if (prev.name !== name) changed.push('name')
    if (!arrayShallowEq(prev.redirectUris ?? [], redirectUris)) {
      changed.push('redirect_uris')
    }
    const newScopes = scopes.length > 0 ? scopes : null
    if (!arrayShallowEq(prev.scopes ?? null, newScopes)) {
      changed.push('scopes')
    }
  }
  if (changed.length > 0) {
    const audit = await recordAdminEvent(
      {
        action: 'app.update',
        targetId: internalId,
        payload: { changed },
      },
      adminSession,
    )
    if (!audit.ok) return audit
  }
  revalidatePath(`/admin/applications/${internalId}`)
  revalidatePath('/admin/applications')
  return { ok: true }
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
