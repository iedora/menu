-- 0004_session_ip.sql — raw client IP on sessions.
--
-- `ip_hash` stays the GDPR-safe correlation key; `ip` adds the real address so
-- the admin "Users" CRM can show where each device signed in from. Captured
-- going forward — existing sessions keep NULL.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip text;
