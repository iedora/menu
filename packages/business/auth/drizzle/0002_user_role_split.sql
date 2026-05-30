-- Split user.scopes (frozen snapshot) into user.role (live preset key)
-- + user.extra_scopes (bespoke grants on top of the role).
--
-- Why: a frozen scopes array means adding a new scope to a role preset
-- (e.g. `staff:menu:restaurants:transfer`) doesn't propagate to existing
-- holders — each user has to be SQL-updated by hand. Storing the role
-- key instead lets `getEffectiveUserScopes()` expand it through the
-- live `STAFF_ROLE_PRESETS[role]` at every check.
--
-- Data migration: every existing scope array is reverse-mapped to a
-- preset where possible.
--   - Exact match against iedora-admin → role='iedora-admin'
--   - Exact match against iedora-support → role='iedora-support'
--   - Any other non-null scope set → kept verbatim in extra_scopes,
--     role=null (treated as bespoke staff with custom powers).
--   - NULL scopes (tenant-only users) → role stays null, extra_scopes=[].

ALTER TABLE "core"."user" ADD COLUMN "role" text;
--> statement-breakpoint
ALTER TABLE "core"."user" ADD COLUMN "extra_scopes" text[] NOT NULL DEFAULT '{}';
--> statement-breakpoint

-- iedora-admin preset (15 scopes as of this migration).
UPDATE "core"."user"
SET role = 'iedora-admin', extra_scopes = '{}'
WHERE scopes IS NOT NULL
  AND scopes @> ARRAY[
    'staff:core:users:read',
    'staff:core:users:ban',
    'staff:core:users:set-role',
    'staff:core:users:impersonate',
    'staff:core:tenants:list',
    'staff:core:tenants:get',
    'staff:core:tenants:delete',
    'staff:core:members:remove',
    'staff:core:members:update-scopes',
    'staff:core:sessions:list',
    'staff:core:sessions:revoke',
    'staff:core:audit:read',
    'staff:core:admin:read',
    'staff:menu:ai:unlimited',
    'staff:menu:restaurants:transfer'
  ]::text[]
  AND ARRAY[
    'staff:core:users:read',
    'staff:core:users:ban',
    'staff:core:users:set-role',
    'staff:core:users:impersonate',
    'staff:core:tenants:list',
    'staff:core:tenants:get',
    'staff:core:tenants:delete',
    'staff:core:members:remove',
    'staff:core:members:update-scopes',
    'staff:core:sessions:list',
    'staff:core:sessions:revoke',
    'staff:core:audit:read',
    'staff:core:admin:read',
    'staff:menu:ai:unlimited',
    'staff:menu:restaurants:transfer'
  ]::text[] @> scopes;
--> statement-breakpoint

-- iedora-support preset.
UPDATE "core"."user"
SET role = 'iedora-support', extra_scopes = '{}'
WHERE scopes IS NOT NULL
  AND role IS NULL
  AND scopes @> ARRAY[
    'staff:core:admin:read',
    'staff:core:users:read',
    'staff:core:users:ban',
    'staff:core:tenants:list',
    'staff:core:tenants:get',
    'staff:core:members:remove',
    'staff:core:sessions:list',
    'staff:core:sessions:revoke'
  ]::text[]
  AND ARRAY[
    'staff:core:admin:read',
    'staff:core:users:read',
    'staff:core:users:ban',
    'staff:core:tenants:list',
    'staff:core:tenants:get',
    'staff:core:members:remove',
    'staff:core:sessions:list',
    'staff:core:sessions:revoke'
  ]::text[] @> scopes;
--> statement-breakpoint

-- Anything else with non-null scopes that didn't match a preset →
-- bespoke staff. Keep the snapshot in extra_scopes so they don't lose
-- the powers they had. Role stays null.
UPDATE "core"."user"
SET extra_scopes = scopes
WHERE scopes IS NOT NULL AND role IS NULL;
--> statement-breakpoint

ALTER TABLE "core"."user" DROP COLUMN "scopes";
