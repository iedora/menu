-- Postgres init script — runs ONCE when the data volume is empty
-- (Postgres image executes everything in /docker-entrypoint-initdb.d/
-- in sorted order during the very first boot).
--
-- One database per iedora product. Each product's migrate.mjs then
-- connects to its own database and runs Drizzle migrations.
--
-- Adding a new product = one line here + `kamal accessory remove postgres`
-- + `rm -rf /root/infra-postgres` + `just infra::deploy` (only viable on
-- a clean wipe; for incremental adds, run `CREATE DATABASE` manually).

CREATE DATABASE menu;
CREATE DATABASE genkan;
