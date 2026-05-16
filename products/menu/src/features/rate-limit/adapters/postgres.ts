import 'server-only'
import { and, eq, lt, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type * as schema from '@/shared/db/schema'
import { rateLimitEvent } from '@/shared/db/schema'
import type { RateLimitDecision, RateLimiter } from '../ports'

// Generic over the driver — accepts both `postgres-js` (production) and
// PGLite (tests). Same surface, different transport.
type LimiterDb = PgDatabase<PgQueryResultHKT, typeof schema>

/**
 * Sliding-window rate limiter backed by a single Postgres table.
 *
 * Layout: `rate_limit_event(key, occurred_at)` with index `(key, occurred_at)`.
 * Each check, inside ONE transaction guarded by a per-key advisory lock:
 *   1. `pg_advisory_xact_lock(hashtext(key))`  ─ serialize same-key calls
 *   2. DELETE expired entries (`occurred_at < now - window`)
 *   3. INSERT a new row for this attempt
 *   4. SELECT count → decide allow/deny
 *
 * The advisory lock is the key piece — without it, two concurrent calls on
 * the same key under READ COMMITTED can both see "count < limit" and both
 * insert, allowing `limit + 1` admissions. With it, calls on different keys
 * never contend (hashtext distributes), and calls on the same key serialize
 * for the duration of the transaction. Equivalent atomicity to the Redis
 * MULTI block this replaces.
 *
 * Per-call cleanup keeps the table small without a separate VACUUM cron: at
 * steady state, a single key holds at most `limit` rows (current window) +
 * whatever this very call added.
 */
export function postgresLimiter(db: LimiterDb): RateLimiter {
  return {
    async check(key, limit, windowMs): Promise<RateLimitDecision> {
      const now = Date.now()
      const cutoff = new Date(now - windowMs)

      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`)

        await tx
          .delete(rateLimitEvent)
          .where(
            and(eq(rateLimitEvent.key, key), lt(rateLimitEvent.occurredAt, cutoff)),
          )

        await tx.insert(rateLimitEvent).values({ key, occurredAt: new Date(now) })

        const [row] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(rateLimitEvent)
          .where(eq(rateLimitEvent.key, key))
        const count = row?.count ?? 0

        if (count > limit) {
          const [oldest] = await tx
            .select({ at: rateLimitEvent.occurredAt })
            .from(rateLimitEvent)
            .where(eq(rateLimitEvent.key, key))
            .orderBy(rateLimitEvent.occurredAt)
            .limit(1)
          const oldestMs = oldest?.at.getTime() ?? now
          const retryAfterMs = Math.max(1, oldestMs + windowMs - now)
          return { ok: false, retryAfterSec: Math.ceil(retryAfterMs / 1000) }
        }

        return {
          ok: true,
          remaining: Math.max(0, limit - count),
          resetAt: now + windowMs,
        }
      })
    },
  }
}
