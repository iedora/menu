'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireActiveOrganization } from '@/features/auth'
import { db } from '@/lib/db'
import { organization } from '@/lib/db/schema'
import { isPlanCode } from './registry'
import type { PlanCode } from './types'

/**
 * Switches the active organization to a target plan. No payment yet — this is
 * the placeholder that the eventual Stripe flow will call once a checkout
 * session settles. UI never trusts the client-supplied code; we re-validate
 * against the registry.
 */
export async function setOrganizationPlan(target: PlanCode) {
  const { organizationId } = await requireActiveOrganization()
  if (!isPlanCode(target)) {
    return { error: 'Unknown plan' as const }
  }
  await db
    .update(organization)
    .set({ plan: target })
    .where(eq(organization.id, organizationId))
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/billing')
  return { ok: true as const, plan: target }
}
