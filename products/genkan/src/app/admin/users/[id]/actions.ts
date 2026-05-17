'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/features/admin'
import { auth } from '@/features/auth/adapters/better-auth-instance'
import { db } from '@/shared/db/client'
import { user } from '@/shared/db/schema'
import { recordAdminEvent } from '../../_lib/audit'

type Result = { ok: true } | { ok: false; error: string }

function toMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object') {
    const obj = e as { message?: unknown; body?: { message?: unknown } }
    if (typeof obj.message === 'string') return obj.message
    if (obj.body && typeof obj.body.message === 'string') return obj.body.message
  }
  return fallback
}

/**
 * Mutations for /admin/users/[id]. Every action: requireAdmin() → call
 * Better Auth's `auth.api.*` so the plugin's invariants (role validation,
 * session invalidation on ban, etc.) run → revalidate the page.
 */

export async function setRoleAction(
  userId: string,
  formData: FormData,
): Promise<Result> {
  const session = await requireAdmin()
  const role = String(formData.get('role') ?? '').trim() || 'user'

  // Snapshot the previous role so the audit row records the diff.
  const [prev] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const fromRole = prev?.role ?? 'user'

  try {
    await auth.api.setRole({
      headers: await headers(),
      // Better Auth narrows the role to its known string-union; accept any
      // text from the form so platform admins can introduce custom roles.
      body: { userId, role: role as 'user' | 'admin' },
    })
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Could not set role.') }
  }
  const audit = await recordAdminEvent(
    {
      action: 'user.role_change',
      targetId: userId,
      payload: { from: fromRole, to: role },
    },
    session,
  )
  if (!audit.ok) return audit
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')
  return { ok: true }
}

export async function banAction(
  userId: string,
  formData: FormData,
): Promise<Result> {
  const session = await requireAdmin()
  const banReason = String(formData.get('banReason') ?? '').trim()
  const banExpiresInDays = Number(formData.get('banExpiresInDays') ?? '')
  const banExpiresIn =
    Number.isFinite(banExpiresInDays) && banExpiresInDays > 0
      ? Math.floor(banExpiresInDays * 86_400)
      : undefined
  const expiresAt =
    banExpiresIn !== undefined
      ? new Date(Date.now() + banExpiresIn * 1000).toISOString()
      : null
  try {
    await auth.api.banUser({
      headers: await headers(),
      body: {
        userId,
        banReason: banReason || undefined,
        banExpiresIn,
      },
    })
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Could not ban user.') }
  }
  const audit = await recordAdminEvent(
    {
      action: 'user.ban',
      targetId: userId,
      payload: {
        ...(banReason ? { reason: banReason } : {}),
        expires: expiresAt,
      },
    },
    session,
  )
  if (!audit.ok) return audit
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')
  return { ok: true }
}

export async function unbanAction(userId: string): Promise<Result> {
  const session = await requireAdmin()
  try {
    await auth.api.unbanUser({
      headers: await headers(),
      body: { userId },
    })
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Could not unban user.') }
  }
  const audit = await recordAdminEvent(
    { action: 'user.unban', targetId: userId },
    session,
  )
  if (!audit.ok) return audit
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')
  return { ok: true }
}

export async function impersonateAction(userId: string) {
  const session = await requireAdmin()
  try {
    await auth.api.impersonateUser({
      headers: await headers(),
      body: { userId },
    })
  } catch (e) {
    return {
      ok: false as const,
      error: toMessage(e, 'Could not impersonate user.'),
    }
  }
  // Record before redirecting — impersonation rewrites the session cookie,
  // so the same headers used here for the audit context are still the
  // admin's. Failing the audit here surfaces by NOT redirecting.
  const audit = await recordAdminEvent(
    { action: 'user.impersonate', targetId: userId },
    session,
  )
  if (!audit.ok) return audit
  redirect('/')
}

export async function revokeSessionAction(
  userId: string,
  sessionToken: string,
): Promise<Result> {
  await requireAdmin()
  try {
    await auth.api.revokeUserSession({
      headers: await headers(),
      body: { sessionToken },
    })
  } catch (e) {
    return {
      ok: false,
      error: toMessage(e, 'Could not revoke session.'),
    }
  }
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/sessions')
  return { ok: true }
}

export async function deleteUserAction(userId: string): Promise<Result> {
  const session = await requireAdmin()
  try {
    await auth.api.removeUser({
      headers: await headers(),
      body: { userId },
    })
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Could not delete user.') }
  }
  // The target user just got deleted; the FK on audit_log.actor_id is
  // `set null` so an admin auditing themselves wouldn't break, but the
  // target_id we're storing still resolves on the read side (string match).
  const audit = await recordAdminEvent(
    { action: 'user.delete', targetId: userId },
    session,
  )
  if (!audit.ok) return audit
  revalidatePath('/admin/users')
  redirect('/admin/users')
}
