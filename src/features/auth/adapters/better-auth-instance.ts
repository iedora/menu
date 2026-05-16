import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins/organization'
import { db } from '@/shared/db/client'
import * as schema from '@/shared/db/schema'
import { env } from '@/shared/env'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),
  trustedOrigins: [env.BETTER_AUTH_URL],
  emailAndPassword: {
    enabled: true,
  },
  // DB-backed rate limit + sessions. We're single-node, so the secondaryStorage
  // pattern (caching across nodes) is redundancy without a payoff. Postgres
  // handles the volume — Better Auth's `rateLimit.storage: 'database'` uses
  // the same Drizzle connection that backs sessions/users/orgs.
  rateLimit: {
    enabled: process.env.DISABLE_AUTH_RATE_LIMIT !== 'true',
    storage: 'database',
  },
  // Trust cloudflared's CF-Connecting-IP only; X-Forwarded-For is spoofable
  // upstream of the tunnel. ipv6Subnet: 64 mitigates CVE-2026-45364 (attackers
  // walking a /64 to evade per-IP throttles).
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['cf-connecting-ip'],
      ipv6Subnet: 64,
    },
  },
  plugins: [organization()],
})

export type Session = typeof auth.$Infer.Session
