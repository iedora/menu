'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/features/admin'
import { auth } from '@/features/auth/adapters/better-auth-instance'
import { db } from '@/shared/db/client'
import { organization } from '@/shared/db/schema'
import { recordAdminEvent } from '../_lib/audit'

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

export async function createOrganizationAction(
  formData: FormData,
): Promise<Result> {
  const session = await requireAdmin()
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
  try {
    await auth.api.createOrganization({
      headers: await headers(),
      body: { name, slug, keepCurrentActiveOrganization: true },
    })
  } catch (e) {
    return {
      ok: false,
      error: toMessage(e, 'Could not create organization. The slug may be taken.'),
    }
  }
  // Better Auth's createOrganization doesn't return the row in a typed
  // shape we can rely on. Look it up by the (just-created) slug — it's
  // unique-indexed so this is a constant-time read.
  const [createdRow] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1)
  if (createdRow) {
    const audit = await recordAdminEvent(
      {
        action: 'org.create',
        targetId: createdRow.id,
        payload: { name, slug },
      },
      session,
    )
    if (!audit.ok) return audit
  }
  revalidatePath('/admin/organizations')
  return { ok: true }
}

export async function deleteOrganizationAction(
  organizationId: string,
): Promise<Result> {
  const session = await requireAdmin()
  try {
    await auth.api.deleteOrganization({
      headers: await headers(),
      body: { organizationId },
    })
  } catch (e) {
    return {
      ok: false,
      error: toMessage(e, 'Could not delete organization.'),
    }
  }
  const audit = await recordAdminEvent(
    { action: 'org.delete', targetId: organizationId },
    session,
  )
  if (!audit.ok) return audit
  revalidatePath('/admin/organizations')
  redirect('/admin/organizations')
}
