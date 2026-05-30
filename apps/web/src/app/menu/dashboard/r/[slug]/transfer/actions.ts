'use server'

import { redirect } from 'next/navigation'
import {
  listUsers,
  searchTenants,
  type Tenant,
} from '@iedora/auth'
import {
  actorFromSession,
  getSession,
  hasScope,
  requireScope,
} from '@iedora/auth/server'
import { SCOPES } from '@iedora/auth/scopes'
import {
  requireRestaurantBySlug,
} from '@iedora/product-menu/features/auth'
import {
  transferRestaurant,
} from '@iedora/product-menu/features/restaurant-identity'

/**
 * Server actions backing the admin-driven restaurant transfer wizard.
 * Every action is gated on `staff:menu:restaurants:transfer`, which the
 * `iedora-admin` preset picks up via the staff:* wildcard. Audit rows
 * are written downstream by the use-case + the auth primitives it calls.
 */

const TRANSFER_SCOPE = SCOPES.menu.staff.restaurants.transfer

export type TenantOption = { id: string; name: string }
export type UserOption = {
  id: string
  email: string
  name: string
  staff: boolean
}

export async function searchTenantsAction(
  query: string,
): Promise<TenantOption[]> {
  await requireScope(TRANSFER_SCOPE)
  const rows = await searchTenants({ search: query, limit: 20 })
  return rows.map((t: Tenant) => ({ id: t.id, name: t.name }))
}

export async function searchUsersAction(
  query: string,
): Promise<UserOption[]> {
  await requireScope(TRANSFER_SCOPE)
  const { users } = await listUsers({ search: query, limit: 20 })
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    staff: u.role !== null || u.extraScopes.length > 0,
  }))
}

export type TransferActionInput = {
  slug: string
  target:
    | { kind: 'existing-tenant'; tenantId: string }
    | { kind: 'new-tenant'; name: string }
  owner:
    | { kind: 'existing-user'; userId: string }
    | { kind: 'new-user'; email: string; name: string; password: string }
}

export type TransferActionResult =
  | { ok: true; fromTenantId: string; toTenantId: string; ownerUserId: string }
  | { ok: false; error: string }

export async function transferRestaurantAction(
  input: TransferActionInput,
): Promise<TransferActionResult> {
  // requireRestaurantBySlug double-checks the admin currently belongs
  // to the source tenant — without it a forged slug could move someone
  // else's restaurant. After the move, the admin no longer belongs to
  // the new tenant (clean handoff per the product decision).
  const { restaurant: r, tenantId: sourceTenantId } =
    await requireRestaurantBySlug(input.slug)

  // The slug-guard above grants per-tenant access; transfer needs the
  // dedicated staff scope on top so an operator with tenant-only
  // ownership can't reassign their own restaurant via this surface.
  if (!(await hasScope(TRANSFER_SCOPE))) {
    return { ok: false, error: 'forbidden: missing transfer scope' }
  }

  const session = await getSession()
  if (!session?.user) return { ok: false, error: 'no session' }

  try {
    const result = await transferRestaurant({
      restaurantId: r.id,
      target: input.target,
      owner: input.owner,
      actor: actorFromSession(session),
    })
    // Per product decision: admin loses access on transfer (clean
    // handoff). Bounce back to the dashboard list instead of leaving
    // them on a 404-bound slug page. Source tenant unchanged, so
    // existing restaurants in that tenant (if any) stay visible.
    if (result.toTenantId !== sourceTenantId) {
      redirect('/menu/dashboard')
    }
    return {
      ok: true,
      fromTenantId: result.fromTenantId,
      toTenantId: result.toTenantId,
      ownerUserId: result.ownerUserId,
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) throw err
    console.error('[transfer] failed', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
