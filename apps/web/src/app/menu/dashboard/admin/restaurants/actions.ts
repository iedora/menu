'use server'

import { revalidatePath } from 'next/cache'
import { createTenant, TENANT_ROLE_PRESETS } from '@iedora/auth'
import {
  actorFromSession,
  getSession,
  requireScope,
  setActiveTenant,
} from '@iedora/auth/server'
import { SCOPES } from '@iedora/auth/scopes'
import { db } from '@iedora/product-menu/shared/db/client'
import { menu, restaurant } from '@iedora/product-menu/shared/db/schema'
import {
  nextAvailableSlug,
  slugify,
} from '@iedora/product-menu/features/restaurant-slug'

/**
 * Admin-driven restaurant provisioning.
 *
 * Workflow: admin creates a fresh tenant + restaurant in one shot, with
 * themselves as the founder. They then build menus through the normal
 * dashboard surfaces (their tenant membership grants access). When the
 * client is ready, the existing transfer flow hands the restaurant +
 * tenant ownership over.
 *
 * Why a fresh tenant per restaurant: each client lives in their own
 * tenant. No shared admin sandbox. The handoff is cleaner — transfer
 * the restaurant to the target tenant + remove admin from this source
 * tenant (manual step today; can be automated as a follow-up).
 *
 * Gated by `staff:menu:restaurants:transfer` — the same scope that
 * already marks "this admin manages restaurants cross-tenant". One
 * scope, two related capabilities (create + transfer).
 */

const SCOPE = SCOPES.menu.staff.restaurants.transfer

export type CreateInput = {
  /** Display name shown on the restaurant page. */
  restaurantName: string
  /** Tenant display name. Defaults to restaurantName when blank. */
  tenantName?: string
}

export type CreateResult =
  | { ok: true; slug: string; tenantId: string }
  | { ok: false; error: string }

export async function createTenantAndRestaurantAction(
  input: CreateInput,
): Promise<CreateResult> {
  await requireScope(SCOPE)
  const session = await getSession()
  if (!session?.user) return { ok: false, error: 'no session' }

  const restaurantName = input.restaurantName.trim()
  if (restaurantName.length === 0) {
    return { ok: false, error: 'restaurantName required' }
  }
  const tenantName = (input.tenantName?.trim() || restaurantName).trim()

  const actor = actorFromSession(session)

  // Step 1 — create the tenant (admin as founder owner). Atomic with
  // its own audit (`tenant.created` + `tenant.member.added`).
  const tenant = await createTenant({
    name: tenantName,
    founder: { userId: session.user.id, scopes: TENANT_ROLE_PRESETS.owner },
    actor,
  })

  // Pin admin's session to this new tenant so subsequent
  // tenant-scoped routes (billing, the onboarding wizard's quota
  // pre-fetch, etc.) resolve in the right tenant context. Each
  // admin-create re-pins; admin always operates in the latest one.
  await setActiveTenant({
    sessionId: session.session.id,
    userId: session.user.id,
    tenantId: tenant.id,
    actor,
  }).catch((err) => {
    console.error('[admin/restaurants/create] setActiveTenant failed', err)
  })

  // Step 2 — allocate slug + insert restaurant + default menu. Same
  // transaction so a half-created restaurant (no menu) is impossible.
  const slug = await nextAvailableSlug(slugify(restaurantName))
  try {
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(restaurant)
        .values({
          tenantId: tenant.id,
          name: restaurantName,
          slug,
        })
        .returning({ id: restaurant.id })
      if (!created) throw new Error('restaurant insert returned no rows')
      await tx.insert(menu).values({
        restaurantId: created.id,
        name: 'Main menu',
      })
    })
  } catch (err) {
    console.error('[admin/restaurants/create] failed', err)
    // The tenant is orphaned (no restaurant). Admin can cleanup or
    // retry by entering the same name — slug allocation makes the
    // retry collision-safe.
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  revalidatePath('/menu/dashboard/admin/restaurants')
  revalidatePath('/menu/dashboard')
  return { ok: true, slug, tenantId: tenant.id }
}
