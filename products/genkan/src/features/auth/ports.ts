import type { Session } from './adapters/better-auth-instance'

/**
 * AuthGateway — the slice's only dependency on the outside world. Genkan's
 * use-cases call methods on this interface; production wires it to
 * `betterAuthGateway` (Better Auth + Drizzle). Tests wire fakes.
 *
 * Keep this surface minimal — only the identity-layer lookups belong here.
 * Tenant-resource guards (e.g. "is this user a member of the org that owns
 * this restaurant?") live in the consuming product's auth slice, not Genkan.
 */
export interface AuthGateway {
  getSession(): Promise<Session | null>
  findEarliestOrgMembership(
    userId: string,
  ): Promise<{ organizationId: string } | null>
}
