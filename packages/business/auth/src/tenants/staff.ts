import 'server-only'
import { and, desc, eq, gt, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { getCoreDb } from '../db'
import { schema } from '../schema'
import type { Scope } from '../rbac/scopes'
import {
  STAFF_ROLE_PRESETS,
  isStaffRole,
  type StaffRoleKey,
} from '../rbac/role-presets'
import { recordAudit } from '../audit/audit'
import { CORE_AUDIT_EVENTS, type AuditActor } from '../audit/audit-events'

/**
 * Cross-tenant (staff) authority primitives. Lives parallel to
 * `tenant-members.ts` (per-tenant authority) and exposes the same
 * shape — `getUserScopes` / `setUserScopes` / `userHasScope` — over
 * the `user.scopes text[]` column.
 *
 * `user.scopes IS NULL` ⇔ regular tenant user (no cross-tenant
 * authority). `user.scopes IS NOT NULL` ⇔ staff (carries an
 * explicit scope set). Adding a new staff role like `'iedora-
 * auditor'` is one entry in `STAFF_ROLE_PRESETS` (in `./permissions`)
 * — this module's signatures don't change.
 *
 * Also home to the ban + impersonation primitives that previously
 * came from better-auth's `admin` plugin. The plugin was dropped to
 * keep staff authority in the same scope-array shape as tenant
 * authority; ban/impersonate are short helpers around the schema
 * columns better-auth had configured.
 */

const { user, session } = schema

export type UserRow = {
  id: string
  name: string
  email: string
  role: StaffRoleKey | null
  extraScopes: Scope[]
  banned: boolean | null
  banReason: string | null
  banExpires: Date | null
  createdAt: Date
  updatedAt: Date
}

// ─── Staff role + extra-scope reads / writes ──────────────────────

/** Returns the user's staff role (named preset), or null for tenants. */
export async function getUserRole(
  userId: string,
): Promise<StaffRoleKey | null> {
  const db = getCoreDb()
  const rows = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const r = rows[0]?.role ?? null
  return isStaffRole(r) ? r : null
}

/** Returns the user's bespoke extra scopes layered on top of the role. */
export async function getUserExtraScopes(userId: string): Promise<Scope[]> {
  const db = getCoreDb()
  const rows = await db
    .select({ extraScopes: user.extraScopes })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return rows[0]?.extraScopes ?? []
}

/**
 * Effective staff scopes for a user — role-preset expansion ∪ bespoke
 * extras. Returns null when the user is tenant-only (role IS NULL AND
 * extra_scopes is empty). Adding a scope to a role preset propagates
 * to every holder of that role with no per-user write.
 */
export async function getEffectiveUserScopes(
  userId: string,
): Promise<Scope[] | null> {
  const role = await getUserRole(userId)
  const extra = await getUserExtraScopes(userId)
  if (role === null && extra.length === 0) return null
  const fromRole: readonly Scope[] = role ? STAFF_ROLE_PRESETS[role] : []
  if (extra.length === 0) return [...fromRole]
  // De-dupe — a bespoke grant may overlap the preset.
  return Array.from(new Set([...fromRole, ...extra]))
}

/**
 * Set the user's staff role. Pass `null` to demote to tenant. Audits
 * the change with `from → to`. Doesn't touch `extra_scopes`.
 */
export async function setUserRole(
  userId: string,
  role: StaffRoleKey | null,
  /** Actor performing the grant. Required — highest blast surface. */
  actor: AuditActor,
): Promise<void> {
  const db = getCoreDb()
  const before = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const previous = before[0]?.role ?? null
  await db
    .update(user)
    .set({ role, updatedAt: new Date() })
    .where(eq(user.id, userId))
  await recordAudit({
    event: CORE_AUDIT_EVENTS.USER_SCOPES_UPDATED,
    outcome: 'success',
    actor,
    target: { userId },
    meta: { kind: 'role', from: previous, to: role },
  })
}

/**
 * Set the user's bespoke extra scopes. Pass `[]` to clear. These add
 * to the role's preset; they do NOT replace it.
 */
export async function setUserExtraScopes(
  userId: string,
  scopes: readonly Scope[],
  actor: AuditActor,
): Promise<void> {
  const db = getCoreDb()
  const before = await db
    .select({ extraScopes: user.extraScopes })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const previous = before[0]?.extraScopes ?? []
  const next = [...scopes]
  await db
    .update(user)
    .set({ extraScopes: next, updatedAt: new Date() })
    .where(eq(user.id, userId))
  await recordAudit({
    event: CORE_AUDIT_EVENTS.USER_SCOPES_UPDATED,
    outcome: 'success',
    actor,
    target: { userId },
    meta: { kind: 'extra', from: previous, to: next },
  })
}

/**
 * Non-throwing scope probe over effective staff scopes. Returns false
 * for anonymous / tenant-only users and for banned staff (ban check is
 * on the session layer, not here — this only consults the grant).
 */
export async function userHasScope(
  userId: string,
  scope: Scope,
): Promise<boolean> {
  const scopes = await getEffectiveUserScopes(userId)
  if (!scopes) return false
  return scopes.includes(scope)
}

/** True iff the user has a staff role OR any bespoke extra scope. */
export async function isStaffUser(userId: string): Promise<boolean> {
  const scopes = await getEffectiveUserScopes(userId)
  return scopes !== null && scopes.length > 0
}

// ─── Back-compat shims kept for callers not yet migrated. ─────────

/** @deprecated use getEffectiveUserScopes / getUserRole. */
export const getUserScopes = getEffectiveUserScopes

/**
 * @deprecated use setUserRole + setUserExtraScopes.
 *
 * Legacy single-array setter. Splits the input on the fly:
 *   - `null` → demote (role=null, extra_scopes=[]).
 *   - matches a staff preset exactly → set role to that key, extra=[].
 *   - any other non-empty array → role=null, extra_scopes=input.
 *
 * Writes both columns + emits a single audit row carrying the
 * combined delta so the timeline matches what callers expect from
 * the legacy single-write API. New code should hit the typed
 * primitives instead (they emit per-column rows).
 */
export async function setUserScopes(
  userId: string,
  scopes: readonly Scope[] | null,
  actor: AuditActor,
): Promise<void> {
  const db = getCoreDb()
  // Late import to avoid a cycle (role-presets imports from this module
  // indirectly via type re-exports in some toolchains).
  const { detectStaffPreset } = await import('../rbac/role-presets')

  let nextRole: StaffRoleKey | null
  let nextExtra: Scope[]
  if (scopes === null) {
    nextRole = null
    nextExtra = []
  } else {
    const preset = detectStaffPreset(scopes as readonly Scope[])
    if (preset) {
      nextRole = preset
      nextExtra = []
    } else {
      nextRole = null
      nextExtra = [...scopes]
    }
  }

  const before = await db
    .select({ role: user.role, extraScopes: user.extraScopes })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const previousRole = (before[0]?.role as StaffRoleKey | null) ?? null
  const previousExtra = before[0]?.extraScopes ?? []

  await db
    .update(user)
    .set({ role: nextRole, extraScopes: nextExtra, updatedAt: new Date() })
    .where(eq(user.id, userId))

  await recordAudit({
    event: CORE_AUDIT_EVENTS.USER_SCOPES_UPDATED,
    outcome: 'success',
    actor,
    target: { userId },
    meta: {
      from: scopesShape(previousRole, previousExtra),
      to: scopesShape(nextRole, nextExtra),
    },
  })
}

function scopesShape(
  role: StaffRoleKey | null,
  extra: readonly Scope[],
): Scope[] | null {
  if (role === null && extra.length === 0) return null
  // Inline expansion mirrors getEffectiveUserScopes without the DB
  // round-trip — the legacy audit meta wants the effective set so the
  // history reads the same shape it always did.
  const fromRole: readonly Scope[] = role ? STAFF_ROLE_PRESETS[role] : []
  if (extra.length === 0) return [...fromRole]
  return Array.from(new Set([...fromRole, ...extra]))
}

// ─── Ban / unban (was: better-auth admin plugin `banUser`) ─────────

export async function banUser(input: {
  userId: string
  reason?: string
  expiresAt?: Date
  /** Actor performing the ban — required for audit attribution. */
  actor: AuditActor
}): Promise<void> {
  const db = getCoreDb()
  await db
    .update(user)
    .set({
      banned: true,
      banReason: input.reason ?? null,
      banExpires: input.expiresAt ?? null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, input.userId))
  await recordAudit({
    event: CORE_AUDIT_EVENTS.USER_BANNED,
    outcome: 'success',
    actor: input.actor,
    target: { userId: input.userId },
    meta: {
      reason: input.reason ?? null,
      expiresAt: input.expiresAt?.toISOString() ?? null,
    },
  })
}

export async function unbanUser(
  userId: string,
  /** Actor performing the unban — required for audit attribution. */
  actor: AuditActor,
): Promise<void> {
  const db = getCoreDb()
  await db
    .update(user)
    .set({
      banned: false,
      banReason: null,
      banExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))
  await recordAudit({
    event: CORE_AUDIT_EVENTS.USER_UNBANNED,
    outcome: 'success',
    actor,
    target: { userId },
  })
}

/**
 * Is the user currently banned (and the ban hasn't expired)? Used by
 * the request gate before allowing the session through.
 */
export async function isBanned(userId: string): Promise<boolean> {
  const db = getCoreDb()
  const now = new Date()
  const rows = await db
    .select({ banned: user.banned, banExpires: user.banExpires })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const row = rows[0]
  if (!row?.banned) return false
  if (row.banExpires && row.banExpires.getTime() <= now.getTime()) return false
  return true
}

// ─── Impersonation (was: better-auth admin plugin `impersonateUser`) ─

/**
 * Start impersonating `targetUserId` from the actor's existing
 * session. Mutates the session in-place: `userId` flips to the
 * target, `impersonatedBy` stores the actor for audit + revert. The
 * caller is responsible for verifying the actor holds the
 * `staff.core.users:impersonate` scope first.
 *
 * Returns the updated session row.
 */
export async function impersonateUser(input: {
  actorSessionId: string
  actorUserId: string
  targetUserId: string
  /** Actor metadata for audit (email + role label). */
  actor: AuditActor
}): Promise<void> {
  const db = getCoreDb()
  await db
    .update(session)
    .set({
      userId: input.targetUserId,
      impersonatedBy: input.actorUserId,
      updatedAt: new Date(),
    })
    .where(eq(session.id, input.actorSessionId))
  await recordAudit({
    event: CORE_AUDIT_EVENTS.USER_IMPERSONATED,
    outcome: 'success',
    actor: input.actor,
    target: { userId: input.targetUserId, sessionId: input.actorSessionId },
  })
}

/**
 * Stop impersonation — restore the session to the actor recorded in
 * `impersonatedBy`. No-op if the session wasn't impersonating.
 */
export async function stopImpersonating(
  sessionId: string,
  /** Actor stopping the impersonation — required for audit attribution. */
  actor: AuditActor,
): Promise<void> {
  const db = getCoreDb()
  const rows = await db
    .select({
      impersonatedBy: session.impersonatedBy,
      currentUserId: session.userId,
    })
    .from(session)
    .where(eq(session.id, sessionId))
    .limit(1)
  const originalActor = rows[0]?.impersonatedBy
  if (!originalActor) return
  const impersonatedUserId = rows[0]?.currentUserId ?? null
  await db
    .update(session)
    .set({
      userId: originalActor,
      impersonatedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(session.id, sessionId))
  await recordAudit({
    event: CORE_AUDIT_EVENTS.USER_IMPERSONATION_STOPPED,
    outcome: 'success',
    actor,
    target: { userId: impersonatedUserId, sessionId },
  })
}

// ─── User listing (was: better-auth admin plugin `listUsers`) ──────

export type ListUsersFilter = {
  /** Free-text — matches email or name (ILIKE). */
  search?: string
  /** Only staff (role IS NOT NULL OR extra_scopes non-empty) or only tenants (the inverse). */
  kind?: 'staff' | 'tenant'
  /** Only banned users (banned=true AND not expired). */
  bannedOnly?: boolean
  limit?: number
  offset?: number
}

export type ListUsersResult = {
  users: UserRow[]
  hasMore: boolean
}

export async function listUsers(
  filter: ListUsersFilter = {},
): Promise<ListUsersResult> {
  const db = getCoreDb()
  const limit = Math.min(filter.limit ?? 50, 200)
  const offset = Math.max(filter.offset ?? 0, 0)

  const conditions = []
  if (filter.search) {
    const q = `%${filter.search}%`
    conditions.push(or(ilike(user.email, q), ilike(user.name, q))!)
  }
  if (filter.kind === 'staff') {
    // role IS NOT NULL OR extra_scopes != '{}' (any bespoke power).
    conditions.push(
      or(
        isNotNull(user.role),
        sql`array_length(${user.extraScopes}, 1) > 0`,
      )!,
    )
  }
  if (filter.kind === 'tenant') {
    conditions.push(
      and(
        isNull(user.role),
        sql`coalesce(array_length(${user.extraScopes}, 1), 0) = 0`,
      )!,
    )
  }
  if (filter.bannedOnly) {
    const now = new Date()
    conditions.push(eq(user.banned, true))
    conditions.push(
      or(isNull(user.banExpires), gt(user.banExpires, now))!,
    )
  }

  const rows = await db
    .select()
    .from(user)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(limit + 1)
    .offset(offset)

  const hasMore = rows.length > limit
  const out = rows.slice(0, limit) as UserRow[]
  return { users: out, hasMore }
}

/** Single-user read. Returns null when not found. */
export async function getUser(userId: string): Promise<UserRow | null> {
  const db = getCoreDb()
  const rows = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return (rows[0] as UserRow | undefined) ?? null
}
