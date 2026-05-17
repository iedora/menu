'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/features/admin'
import { requireFreshSession } from '@/features/auth'
import { auth } from '@/features/auth/adapters/better-auth-instance'
import { db } from '@/shared/db/client'
import { invitation, member, organization, session } from '@/shared/db/schema'
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

const slugRegex = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

export async function updateOrganizationAction(
  organizationId: string,
  formData: FormData,
): Promise<Result> {
  const adminSession = await requireAdmin()
  const name = String(formData.get('name') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase()
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: 'Name must be 2–80 characters.' }
  }
  if (!slugRegex.test(slug)) {
    return {
      ok: false,
      error: 'Slug must be 2–40 lowercase letters / numbers / hyphens.',
    }
  }

  // Snapshot the current row so the audit `changed` list only contains
  // columns the operator actually touched.
  const [prev] = await db
    .select({ name: organization.name, slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1)

  // Better Auth's updateOrganization requires the caller to be a member of
  // the org. Platform admins generally aren't, so we update the row directly
  // through Drizzle for these two columns. Membership/role mutations still
  // go through the plugin so its invariants run.
  try {
    await db
      .update(organization)
      .set({ name, slug })
      .where(eq(organization.id, organizationId))
  } catch (e) {
    return {
      ok: false,
      error: toMessage(e, 'Could not update organization.'),
    }
  }
  const changed: string[] = []
  if (prev && prev.name !== name) changed.push('name')
  if (prev && prev.slug !== slug) changed.push('slug')
  if (changed.length > 0) {
    const audit = await recordAdminEvent(
      {
        action: 'org.update',
        targetId: organizationId,
        payload: { changed },
      },
      adminSession,
    )
    if (!audit.ok) return audit
  }
  revalidatePath(`/admin/organizations/${organizationId}`)
  revalidatePath('/admin/organizations')
  return { ok: true }
}

export async function inviteMemberAction(
  organizationId: string,
  formData: FormData,
): Promise<Result> {
  const adminSession = await requireAdmin()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const role = String(formData.get('role') ?? '').trim() || 'member'
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, error: 'Enter a valid email address.' }
  }
  try {
    await auth.api.createInvitation({
      headers: await headers(),
      body: {
        email,
        // Cast: Better Auth narrows the role to its plugin's union of known
        // roles. We accept any string from the form so admin operators can
        // assign custom roles defined elsewhere.
        role: role as 'member' | 'admin' | 'owner',
        organizationId,
      },
    })
  } catch (e) {
    return {
      ok: false,
      error: toMessage(e, 'Could not send invitation.'),
    }
  }
  // Recording at invite time captures admin intent immediately. The actual
  // member row is created when the invitee accepts — that's a user action,
  // not an admin one, so it's deliberately not double-logged here.
  const audit = await recordAdminEvent(
    {
      action: 'org.member_add',
      targetId: organizationId,
      payload: { email, role },
    },
    adminSession,
  )
  if (!audit.ok) return audit
  revalidatePath(`/admin/organizations/${organizationId}`)
  return { ok: true }
}

export async function removeMemberAction(
  organizationId: string,
  memberIdOrEmail: string,
): Promise<Result> {
  const adminSession = await requireAdmin()
  // Resolve `memberIdOrEmail` (the form passes the member row id) to a
  // user_id BEFORE the removal so the audit payload stays consistent.
  // Fall back to the raw input if no row matches — keeps the trail intact
  // for already-removed targets.
  let resolvedUserId = memberIdOrEmail
  const [memberRow] = await db
    .select({ userId: member.userId })
    .from(member)
    .where(eq(member.id, memberIdOrEmail))
    .limit(1)
  if (memberRow) resolvedUserId = memberRow.userId

  try {
    await auth.api.removeMember({
      headers: await headers(),
      body: { memberIdOrEmail, organizationId },
    })
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Could not remove member.') }
  }
  const audit = await recordAdminEvent(
    {
      action: 'org.member_remove',
      targetId: organizationId,
      payload: { user_id: resolvedUserId },
    },
    adminSession,
  )
  if (!audit.ok) return audit
  revalidatePath(`/admin/organizations/${organizationId}`)
  return { ok: true }
}

export async function cancelInvitationAction(
  organizationId: string,
  invitationId: string,
): Promise<Result> {
  await requireAdmin()
  try {
    await db.delete(invitation).where(eq(invitation.id, invitationId))
  } catch (e) {
    return { ok: false, error: toMessage(e, 'Could not cancel invitation.') }
  }
  revalidatePath(`/admin/organizations/${organizationId}`)
  return { ok: true }
}

export async function deleteOrganizationAction(
  organizationId: string,
): Promise<Result> {
  const adminSession = await requireAdmin()
  await requireFreshSession({ returnTo: `/admin/organizations/${organizationId}` })
  try {
    // CASCADE on member / invitation drops dependents. session.activeOrgId
    // has no FK, so we null it out for sessions pointing at this org.
    await db
      .update(session)
      .set({ activeOrganizationId: null })
      .where(eq(session.activeOrganizationId, organizationId))
    await db.delete(organization).where(eq(organization.id, organizationId))
  } catch (e) {
    return {
      ok: false,
      error: toMessage(e, 'Could not delete organization.'),
    }
  }
  const audit = await recordAdminEvent(
    { action: 'org.delete', targetId: organizationId },
    adminSession,
  )
  if (!audit.ok) return audit
  revalidatePath('/admin/organizations')
  redirect('/admin/organizations')
}
