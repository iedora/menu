import 'server-only'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from './better-auth-instance'
import { db } from '@/shared/db/client'
import { member } from '@/shared/db/schema'
import type { AuthGateway } from '../ports'

/**
 * Production AuthGateway. Wraps Better Auth (session lookup) and Drizzle
 * (membership lookups). Server-only — `headers()` and the Drizzle client
 * never belong on the client.
 */
export const betterAuthGateway: AuthGateway = {
  async getSession() {
    return auth.api.getSession({ headers: await headers() })
  },

  async findEarliestOrgMembership(userId) {
    const rows = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))
      .orderBy(member.createdAt)
      .limit(1)
    return rows[0] ?? null
  },
}
