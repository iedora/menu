-- 0006_sessions_uuidv7.sql — time-ordered session ids.
--
-- `sessions` is the most insert-heavy table in auth (a row per login AND per
-- refresh rotation). Switch its id default from random uuid_generate_v4() to the
-- time-ordered native uuidv7() (Postgres 18), so new ids land at the right edge
-- of the B-tree instead of scattering — less index fragmentation and write
-- amplification on the hottest write path. Matches the convention already used
-- by password_reset_tokens (0003). New rows only; ids stay opaque everywhere, so
-- no backfill and no app/test changes.
ALTER TABLE sessions ALTER COLUMN id SET DEFAULT uuidv7();
