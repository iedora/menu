import { type Kysely, sql } from "kysely";

import type { Restaurant } from "../domain";
import type { MenuDB } from "../schema";

// Public-view metrics, two-table atomic pattern — ports Go internal/menu/
// views.go. view_seen dedups one count per visitor/restaurant/hour; daily_view
// accumulates per-day-per-language counters. All bucketing is UTC.

function dayString(t: Date): string {
  return t.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function hourBucket(t: Date): string {
  return `${dayString(t)}-${String(t.getUTCHours()).padStart(2, "0")}`; // YYYY-MM-DD-HH
}

// recordView counts one public menu view in a single atomic statement: the
// dedup insert wins at most once per visitor/restaurant/hour, and only that
// winning row drives the daily-counter increment (CTE → conditional upsert).
// Genuinely idempotent under retries.
export async function recordView(
  db: Kysely<MenuDB>,
  r: Restaurant,
  visitorId: string,
  language: string,
  now: Date,
): Promise<void> {
  await sql`
    WITH won AS (
      INSERT INTO view_seen (visitor_id, restaurant_id, hour_bucket)
      VALUES (${visitorId}, ${r.id}, ${hourBucket(now)}) ON CONFLICT DO NOTHING
      RETURNING 1)
    INSERT INTO daily_view (restaurant_id, tenant_id, day, language, count)
    SELECT ${r.id}, ${r.tenantId}, ${dayString(now)}, ${language}, 1 FROM won
    ON CONFLICT (restaurant_id, day, language) DO UPDATE SET count = daily_view.count + 1
  `.execute(db);
}
