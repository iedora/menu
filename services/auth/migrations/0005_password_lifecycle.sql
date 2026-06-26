-- 0005_password_lifecycle.sql — track when a password last changed, and let an
-- admin force a change at next login.
--
-- `password_changed_at` powers the "Last password change" line in the admin
-- Users CRM and the owner's own security settings. Existing rows backfill to
-- `created_at` (the password was set at registration).
--
-- `must_change_password` is the force-change flag: while true, the user can sign
-- in with their current password but is then made to set a new one before
-- continuing. Cleared when they do.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
UPDATE users SET password_changed_at = created_at WHERE password_changed_at IS NULL;
ALTER TABLE users ALTER COLUMN password_changed_at SET DEFAULT now();
ALTER TABLE users ALTER COLUMN password_changed_at SET NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
