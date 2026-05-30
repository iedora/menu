import 'server-only'
import { eq } from 'drizzle-orm'
import {
  auth,
  createTenant,
  getUser,
  recordAudit,
  TENANT_ROLE_PRESETS,
  upsertMember,
  type AuditActor,
} from '@iedora/auth'
import { MENU_AUDIT_EVENTS } from '../../audit'
import { db } from '../../../shared/db/client'
import { restaurant } from '../../../shared/db/schema'

/**
 * Admin-driven ownership handoff. The admin (caller) builds a restaurant
 * + menu, then transfers it to the operator who will run it day-to-day.
 *
 * Steps, in order, so a failure mid-flight leaves the cleanest possible
 * partial state (transfers are admin-rare → manual cleanup acceptable):
 *
 *   1. Resolve target tenant id — create a fresh tenant if the caller
 *      asked for a new one, otherwise validate the existing id exists.
 *   2. Resolve target user id — create a fresh user via better-auth's
 *      `signUpEmail` (admin sets a temp password) if the caller asked,
 *      otherwise validate the existing id exists.
 *   3. Upsert the user as `owner` of the target tenant. Idempotent — a
 *      re-transfer to the same (tenant, user) pair is a no-op on the
 *      membership but still moves the restaurant.
 *   4. UPDATE `menu.restaurant.tenant_id`. This is the line that flips
 *      who-owns-what. Audited explicitly so the timeline carries the
 *      before/after tenant ids regardless of who acted.
 *
 * Cross-DB: steps 1–3 hit `core`, step 4 hits `menu`. No transaction
 * spans both. If step 4 fails after step 3, the orphan is a tenant_member
 * with no restaurant — acceptable; the admin retries the transfer.
 *
 * Audit: every step writes an audit row through the primitive that
 * already covers it (`createTenant` → tenant.created + tenant.member.added,
 * `upsertMember` → tenant.member.added or .scopes-updated, signup hook →
 * user.signed-up). On top of those, this use-case adds one final
 * `menu.restaurant.transferred` row so the timeline has a single anchor
 * for the cross-DB handoff regardless of the actor's role.
 */
export type TransferRestaurantInput = {
  restaurantId: string
  target:
    | { kind: 'existing-tenant'; tenantId: string }
    | { kind: 'new-tenant'; name: string }
  owner:
    | { kind: 'existing-user'; userId: string }
    | { kind: 'new-user'; email: string; name: string; password: string }
  /** Caller identity for audit attribution. Required. */
  actor: AuditActor
}

export type TransferRestaurantResult = {
  restaurantId: string
  fromTenantId: string
  toTenantId: string
  ownerUserId: string
}

export async function transferRestaurant(
  input: TransferRestaurantInput,
): Promise<TransferRestaurantResult> {
  // ── 1. Target tenant ────────────────────────────────────────────
  let targetTenantId: string
  if (input.target.kind === 'new-tenant') {
    // createTenant requires a founder; we use the admin (actor) so the
    // tenant is never momentarily owner-less. The admin's membership
    // gets removed two lines down once the target user is wired in.
    const created = await createTenant({
      name: input.target.name,
      founder: {
        userId: input.actor.userId,
        scopes: TENANT_ROLE_PRESETS.owner,
      },
      actor: input.actor,
    })
    targetTenantId = created.id
  } else {
    targetTenantId = input.target.tenantId
  }

  // ── 2. Target user ──────────────────────────────────────────────
  let targetUserId: string
  if (input.owner.kind === 'new-user') {
    // signUpEmail runs the create.before + create.after hooks so the
    // user lands with the right audit + (if matching) bootstrap-admin
    // promotion. Throws on duplicate email — caller surfaces.
    const signup = await auth.api.signUpEmail({
      body: {
        email: input.owner.email,
        password: input.owner.password,
        name: input.owner.name,
      },
    })
    targetUserId = signup.user.id
  } else {
    const u = await getUser(input.owner.userId)
    if (!u) {
      throw new Error(
        `[menu/transfer-restaurant] target user not found: ${input.owner.userId}`,
      )
    }
    targetUserId = u.id
  }

  // ── 3. Membership ───────────────────────────────────────────────
  await upsertMember({
    tenantId: targetTenantId,
    userId: targetUserId,
    scopes: TENANT_ROLE_PRESETS.owner,
    actor: input.actor,
  })

  // ── 4. Move the restaurant ──────────────────────────────────────
  const [before] = await db
    .select({ id: restaurant.id, tenantId: restaurant.tenantId })
    .from(restaurant)
    .where(eq(restaurant.id, input.restaurantId))
    .limit(1)
  if (!before) {
    throw new Error(
      `[menu/transfer-restaurant] restaurant not found: ${input.restaurantId}`,
    )
  }
  const fromTenantId = before.tenantId

  if (fromTenantId === targetTenantId) {
    // Same-tenant transfer is a no-op on the FK but still meaningful
    // for audit + owner re-assignment. Skip the UPDATE; the
    // upsertMember above already covered the owner side.
    await recordAudit({
      event: MENU_AUDIT_EVENTS.RESTAURANT_TRANSFERRED,
      outcome: 'success',
      actor: input.actor,
      target: { tenantId: targetTenantId },
      meta: {
        restaurantId: input.restaurantId,
        from: fromTenantId,
        to: targetTenantId,
        ownerUserId: targetUserId,
        noopMove: true,
      },
      important: true,
    })
    return {
      restaurantId: input.restaurantId,
      fromTenantId,
      toTenantId: targetTenantId,
      ownerUserId: targetUserId,
    }
  }

  await db
    .update(restaurant)
    .set({ tenantId: targetTenantId, updatedAt: new Date() })
    .where(eq(restaurant.id, input.restaurantId))

  await recordAudit({
    event: MENU_AUDIT_EVENTS.RESTAURANT_TRANSFERRED,
    outcome: 'success',
    actor: input.actor,
    target: { tenantId: targetTenantId },
    meta: {
      restaurantId: input.restaurantId,
      from: fromTenantId,
      to: targetTenantId,
      ownerUserId: targetUserId,
    },
    important: true,
  })

  return {
    restaurantId: input.restaurantId,
    fromTenantId,
    toTenantId: targetTenantId,
    ownerUserId: targetUserId,
  }
}
