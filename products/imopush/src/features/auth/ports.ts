/**
 * Auth slice ports — narrow surface over @iedora/auth.
 *
 * Identity (sessions, users, orgs, memberships) lives in @iedora/auth's
 * `core` schema (shared cross-product). imopush has no DB-backed
 * ownership lookups of its own (yet) — every domain table just carries
 * `tenant_id` and queries filter on it.
 */

export type Session = {
  user: {
    id: string
    email: string
    name: string
    scopes: string[] | null
  }
  session: {
    id: string
    activeTenantId: string | null
  }
}

export interface AuthGateway {
  getSession(): Promise<Session | null>
}
