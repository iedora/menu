-- Transform a live menu audit_log (action event-log schema) INTO @iedora/audit's
-- schema, in place. Run inside the audit schema (search_path=audit). Idempotent-
-- ish: keeps the old table as audit_log_old for rollback. Wrap in a transaction.
BEGIN;

ALTER TABLE audit_log RENAME TO audit_log_old;
ALTER TABLE audit_log_default RENAME TO audit_log_old_default;

-- @iedora/audit target schema (partitioned entity/action log).
CREATE TABLE audit_log (
  id             uuid        NOT NULL DEFAULT uuidv7(),
  tenant_id      uuid,
  source         text,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  actor_type     text,
  actor_id       text,
  action         text        NOT NULL,
  entity_type    text,
  entity_id      text,
  outcome        text        NOT NULL DEFAULT 'success',
  old_data       jsonb,
  new_data       jsonb,
  changed_fields jsonb,
  metadata       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ip             text,
  user_agent     text,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
CREATE TABLE audit_log_default PARTITION OF audit_log DEFAULT;
CREATE INDEX audit_log_occurred_brin ON audit_log USING brin (occurred_at);
CREATE INDEX audit_log_entity_idx ON audit_log (tenant_id, entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_log_actor_idx  ON audit_log (tenant_id, actor_id, occurred_at DESC);
CREATE INDEX audit_log_action_idx ON audit_log (tenant_id, action, occurred_at DESC);
CREATE INDEX audit_log_source_idx ON audit_log (tenant_id, source, occurred_at DESC);

-- Backfill: target→entity, at→occurred_at, session_id/trace_id folded into
-- metadata (jsonb_strip_nulls drops absent keys), meta→metadata.
INSERT INTO audit_log
  (id, tenant_id, source, occurred_at, actor_type, actor_id, action,
   entity_type, entity_id, outcome, metadata, ip, user_agent)
SELECT
  id, tenant_id, source, at, actor_type, actor_id, action,
  target_type, target_id, outcome,
  COALESCE(meta, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'session_id', session_id, 'trace_id', trace_id)),
  ip, user_agent
FROM audit_log_old;

-- The @iedora/messaging inbox (dedup) — used going forward by the ingester.
CREATE TABLE IF NOT EXISTS inbox_message (
  message_id text PRIMARY KEY, topic text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- Verify counts match before committing.
DO $$
DECLARE old_n bigint; new_n bigint;
BEGIN
  SELECT count(*) INTO old_n FROM audit_log_old;
  SELECT count(*) INTO new_n FROM audit_log;
  IF old_n <> new_n THEN
    RAISE EXCEPTION 'audit_log row count mismatch: old=% new=%', old_n, new_n;
  END IF;
END $$;

COMMIT;
-- After verifying the app reads correctly: DROP TABLE audit_log_old CASCADE;
