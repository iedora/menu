# Live menu → single-DB consolidation + package migration (runbook)

Consolidates the four live menu databases (`auth`, `audit`, `billing`, `menu`,
today separate DBs on one Postgres instance) into ONE database `iedora` with a
schema per service, and adopts the `@iedora/*` package schemas (audit →
`@iedora/audit`, outbox → `@iedora/messaging`). Take a maintenance window.

Prereqs: superuser psql on the Postgres instance; a backup (`pg_dumpall`) taken
first; the new code (commit that migrates services onto `@iedora/*` + `DB_SCHEMA`)
built but NOT yet serving.

## 0. Backup
    pg_dumpall -U iedora > /backup/pre-consolidation-$(date +%F).sql

## 1. Drain the outbox to zero (avoids a payload-shape migration)
The new code reads `outbox_message` (jsonb, @iedora/audit event shape); the old
`outbox` holds bytea envelopes in the OLD shape. Rather than transform pending
rows, DRAIN them with the OLD code first:
- Stop producers' write traffic (or the whole app) so no new rows are enqueued.
- Let the running OLD relay deliver until each producer DB has
  `SELECT count(*) FROM outbox WHERE published_at IS NULL AND failed_at IS NULL` = 0.
- Only then proceed. (Dead-lettered rows, failed_at IS NOT NULL, are inspected
  manually; they are not auto-migrated.)

## 2. Create the target DB + consolidate each service into its schema
Clone each live DB, rename its `public` schema to the service name, and load that
schema into `iedora`. Robust (no text munging) because it uses ALTER SCHEMA.

    createdb -U iedora iedora
    for svc in auth audit billing menu; do
      # no active connections to <svc> during the clone
      createdb -U iedora -T "$svc" "tmp_$svc"
      psql -U iedora -d "tmp_$svc" -c "ALTER SCHEMA public RENAME TO $svc"
      pg_dump -U iedora --no-owner -n "$svc" "tmp_$svc" | psql -U iedora -d iedora
      dropdb -U iedora "tmp_$svc"
    done

Now `iedora` has schemas auth/audit/billing/menu, each with that service's tables.

## 3. Transform the audit schema to @iedora/audit
The audit service's `audit_log` was an action event-log; the new code uses
`@iedora/audit`'s entity/action schema. Apply the tested transform IN the audit
schema (maps target→entity, at→occurred_at, session_id/trace_id→metadata, keeps
the old table as `audit_log_old` for rollback):

    psql -U iedora -d iedora -c "SET search_path = audit" -f 20_transform_audit_log.sql

(Verified against a synthetic live schema: row counts match; entity/metadata/
source map correctly.)

## 4. Add the messaging tables per producer schema
The new relay uses `outbox_message` + `inbox_message`. The services' own
`0007_messaging.sql` / `0004_messaging.sql` migrations create them (IF NOT
EXISTS). Running each service's migrate against `iedora` with its `DB_SCHEMA`
applies every pending migration, including these:

    AUTH_DATABASE_URL=postgres://…/iedora    DB_SCHEMA=auth    bun services/auth/src/migrate.ts
    AUDIT_DATABASE_URL=postgres://…/iedora    DB_SCHEMA=audit    bun services/audit/src/migrate.ts
    BILLING_DATABASE_URL=postgres://…/iedora  DB_SCHEMA=billing  bun services/billing/src/migrate.ts
    MENU_DATABASE_URL=postgres://…/iedora     DB_SCHEMA=menu     bun services/menu/src/migrate.ts

`schema_migrations` came over per-schema in step 2, so only NEW migrations run.
(For the audit schema, the transform in step 3 already built the new audit_log;
ensure `0005_adopt_iedora_audit.sql` is recorded in audit.schema_migrations so it
isn't re-run — `INSERT INTO audit.schema_migrations(name) VALUES
('0005_adopt_iedora_audit.sql') ON CONFLICT DO NOTHING;`.)

## 5. Point the app at the one DB + deploy
compose/Kamal env: every `*_DATABASE_URL` → `postgres://…/iedora`; set `DB_SCHEMA`
per service (auth/audit/billing/menu) and `AUDIT_DB_SCHEMA=audit`. Deploy the new
code. Smoke-test: register/login (auth), a menu write emits an audit event, GET
the audit feed.

## 6. Cleanup (after a soak period)
    -- per service schema, once confident:
    psql -U iedora -d iedora -c "DROP TABLE audit.audit_log_old CASCADE"
    -- drop the legacy per-service databases once the new DB is authoritative:
    dropdb auth; dropdb audit; dropdb billing; dropdb menu

## Rollback
Before step 5 deploy: point the app back at the old per-service DBs (unchanged).
After the audit transform: `audit_log_old` is intact; swap it back with a rename.
Full fallback: restore the step-0 dump.

## Splitting a service back onto its own DB later
Unset `DB_SCHEMA` (or set it empty) for that service and point its
`*_DATABASE_URL` at a dedicated database. No code change — the search_path option
just isn't added, so the service uses that DB's default schema.
