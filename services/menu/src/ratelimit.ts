import type { Database } from "@iedora/server-kit";
import { sql } from "kysely";

import { RateLimitError } from "./errors";

// Sliding-window rate limiter backed by Postgres — ports Go
// internal/menu/ratelimit.go. Each check runs in one transaction under a
// per-key advisory lock: prune expired events, count the window, insert this
// one only when allowed (a denied request must not consume a slot). The table
// self-prunes; no Redis, no vacuum job.

interface Policy {
  name: string;
  limit: number;
  windowSeconds: number;
  failClosed: boolean; // outage behavior: deny (security/cost) vs allow (cosmetic)
}

const MINUTE = 60;
const HOUR = 3600;

export const Policies: Record<string, Policy> = {
  presign: { name: "presign", limit: 30, windowSeconds: MINUTE, failClosed: true },
  commit: { name: "commit", limit: 60, windowSeconds: MINUTE, failClosed: true },
  clear: { name: "clear", limit: 20, windowSeconds: MINUTE, failClosed: false },
  identity: { name: "identity", limit: 30, windowSeconds: MINUTE, failClosed: false },
  onboarding: { name: "onboarding", limit: 10, windowSeconds: HOUR, failClosed: false },
  beacon: { name: "beacon", limit: 600, windowSeconds: MINUTE, failClosed: false },
  // Per-restaurant cap bounds view inflation independent of IP/cookie.
  beacon_rest: { name: "beacon_rest", limit: 5000, windowSeconds: HOUR, failClosed: false },
};

export class Limiter {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly database: Database<any>,
    private readonly disabled = false,
  ) {}

  // allow records one event for `policy:scope`; resolves when within the limit,
  // throws RateLimitError when over it. Backend failures follow failClosed.
  async allow(policyName: string, scope: string): Promise<void> {
    if (this.disabled) return;
    const p = Policies[policyName];
    if (!p) throw new Error(`menu: unknown rate-limit policy ${policyName}`);
    const key = `${p.name}:${scope}`;

    let count = 0;
    let oldest = new Date();
    try {
      const r = await this.database.root.transaction().execute(async (trx) => {
        await sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`.execute(trx);
        await sql`
          DELETE FROM rate_limit_events
          WHERE key=${key} AND occurred_at < now() - make_interval(secs => ${p.windowSeconds})
        `.execute(trx);
        const res = await sql<{ count: string; oldest: Date }>`
          SELECT count(*)::text AS count, coalesce(min(occurred_at), now()) AS oldest
          FROM rate_limit_events WHERE key=${key}
        `.execute(trx);
        const row = res.rows[0]!;
        const n = Number(row.count);
        if (n < p.limit) {
          await sql`INSERT INTO rate_limit_events (key) VALUES (${key})`.execute(trx);
        }
        return { n, oldest: row.oldest };
      });
      count = r.n;
      oldest = r.oldest instanceof Date ? r.oldest : new Date(r.oldest);
    } catch (err) {
      console.warn(
        JSON.stringify({ level: "warn", msg: "rate limiter backend error", policy: p.name, err: String(err) }),
      );
      if (p.failClosed) throw new RateLimitError(p.windowSeconds);
      return;
    }
    if (count >= p.limit) {
      const retryMs = oldest.getTime() + p.windowSeconds * 1000 - Date.now();
      throw new RateLimitError(Math.max(1, Math.ceil(retryMs / 1000)));
    }
  }
}
