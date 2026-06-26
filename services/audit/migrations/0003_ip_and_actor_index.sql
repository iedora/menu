-- 0003_ip_and_actor_index.sql — raw client IP + a cross-tenant actor feed.
--
-- 1. `ip` (raw text) is added alongside the existing `ip_hash`. The hash stays
--    the GDPR-safe correlation key; `ip` is the real address captured going
--    forward for the admin security view (the user-management CRM). Historical
--    rows keep NULL. Producers that don't carry a client IP (system/service
--    events) write NULL too.
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip text;

-- 2. The admin "everything this user did" feed loads a single actor's trail
--    ACROSS tenants: `WHERE actor_id = $1 ORDER BY (at, id) DESC`. The 0001
--    actor index is `(tenant_id, actor_id, at)` — tenant-leading — so that
--    cross-tenant query had no usable index and fell back to a full scan. This
--    mirrors the per-target index but keyed by actor. Created on the partitioned
--    parent so it cascades to every partition.
CREATE INDEX IF NOT EXISTS audit_log_actor_at_idx ON audit_log (actor_id, at DESC, id DESC);
