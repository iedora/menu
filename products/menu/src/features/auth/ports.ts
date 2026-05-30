/**
 * Auth slice ports — the narrow surface backed by better-auth + Drizzle.
 *
 * Identity (sessions, users, orgs, memberships) lives in the `@iedora/auth`
 * `core` schema; restaurant ownership lives in the menu DB. The gateway
 * unifies the two so use-cases speak in domain terms (Session + tenant
 * restaurants) instead of two separate libraries.
 */

/**
 * The session shape consumed by the rest of the menu app.
 *
 * Source: better-auth's `auth.api.getSession()` (for the user) and
 * `@iedora/auth/server.getActiveTenantId()` (for the active tenant id,
 * with lazy membership revalidation). Translated by `adapters/drizzle.ts`.
 *
 * `role` is the named staff preset (`'iedora-admin'` / `'iedora-support'`
 * / `null` for tenants). `extraScopes` carries bespoke grants layered
 * on top of the role. Effective staff scopes = preset[role] ∪ extraScopes —
 * compute via `@iedora/auth.getEffectiveUserScopes` when needed.
 * Tenant-level scopes are NOT on the session; read via
 * `getMemberScopes(activeTenant, userId)`.
 */
export type Session = {
  user: {
    id: string
    email: string
    name: string
    role: string | null
    extraScopes: string[]
  }
  session: {
    id: string
    activeTenantId: string | null
  }
}

/**
 * The gateway. One method per atomic read; no Drizzle / better-auth /
 * Next types leak past the interface so adapters can be swapped (e.g. a
 * PGLite fake in tests).
 */
export interface AuthGateway {
  /** Decoded session or null when not signed in / expired / tampered. */
  getSession(): Promise<Session | null>

  /** Look up a menu restaurant by id, scoped to a tenant org. */
  findRestaurantByIdInOrg(params: {
    restaurantId: string
    tenantId: string
  }): Promise<{ id: string } | null>

  /** Same, but resolved by URL slug. */
  /**
   * Cross-tenant slug lookup — finds the restaurant in ANY tenant.
   * Caller must already be authorised cross-tenant (the staff branch
   * of `requireRestaurantBySlug` is the only legit caller today).
   */
  findRestaurantBySlugAnyOrg(slug: string): Promise<
    | { id: string; name: string; slug: string; tenantId: string }
    | null
  >

  findRestaurantBySlugInOrg(params: {
    slug: string
    tenantId: string
  }): Promise<{ id: string; name: string; slug: string } | null>
}
