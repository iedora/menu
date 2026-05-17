/**
 * Typed event union for the platform audit log. Each variant pins both
 * the action literal and the shape of its payload — admin actions destructure
 * one of these into `record()` so a typo in either column is a compile error.
 *
 * Adding a new event:
 *   1. Add the variant here.
 *   2. Add the call site in the relevant `actions.ts`.
 *   3. Add the literal to `ALL_AUDIT_ACTIONS` below so the /admin/audit
 *      page can filter by it.
 *
 * NEVER put secrets in `payload`. For `webhook.register` record url + events
 * but not the HMAC secret; for `app.register` record name + redirect_uris
 * but not the OAuth client_secret.
 */
export type AuditEvent =
  | {
      action: 'user.ban'
      targetId: string
      payload: { reason?: string; expires?: string | null }
    }
  | { action: 'user.unban'; targetId: string }
  | { action: 'user.delete'; targetId: string }
  | {
      action: 'user.role_change'
      targetId: string
      payload: { from: string; to: string }
    }
  | { action: 'user.impersonate'; targetId: string }
  | {
      action: 'org.create'
      targetId: string
      payload: { name: string; slug: string }
    }
  | { action: 'org.update'; targetId: string; payload: { changed: string[] } }
  | { action: 'org.delete'; targetId: string }
  | {
      action: 'org.member_add'
      targetId: string
      payload: { user_id: string; role: string }
    }
  | {
      action: 'org.member_remove'
      targetId: string
      payload: { user_id: string }
    }
  | {
      action: 'org.member_role_change'
      targetId: string
      payload: { user_id: string; from: string; to: string }
    }
  | {
      action: 'app.register'
      targetId: string
      payload: { name: string; redirect_uris: string[] }
    }
  | { action: 'app.update'; targetId: string; payload: { changed: string[] } }
  | { action: 'app.delete'; targetId: string }
  | {
      action: 'webhook.register'
      targetId: string
      payload: { url: string; events: string[] | null }
    }
  | {
      action: 'webhook.update'
      targetId: string
      payload: { changed: string[] }
    }
  | { action: 'webhook.delete'; targetId: string }
  | {
      action: 'grant.revoke'
      targetId: string
      payload: { user_id: string; client_id: string }
    }

/**
 * Caller-supplied context for `record()`. Read from the action's request
 * headers via `getRequestContext(headers)`. `actorId` is `null` when the
 * action is invoked by an unauthenticated caller (extremely rare — should
 * only happen for system-triggered events).
 */
export type AuditContext = {
  actorId: string | null
  actorRole: string | null
  ip: string | null
  userAgent: string | null
}

/** Stable mapping from variant to (targetType, action) used by adapters. */
export function targetTypeFor(action: AuditEvent['action']): string {
  if (action.startsWith('user.')) return 'user'
  if (action.startsWith('org.')) return 'organization'
  if (action.startsWith('app.')) return 'oauth_client'
  if (action.startsWith('webhook.')) return 'webhook_subscription'
  if (action.startsWith('grant.')) return 'oauth_consent'
  // Future-proof: unknown prefixes fall back to the action's own prefix so
  // the page filter still groups them sensibly.
  const prefix = action.split('.')[0]
  return prefix ?? 'unknown'
}

/**
 * Every action literal in `AuditEvent`. Keep in sync with the union — the
 * audit page renders this as a multi-select filter, and tests over the
 * union should iterate this list.
 */
export const ALL_AUDIT_ACTIONS = [
  'user.ban',
  'user.unban',
  'user.delete',
  'user.role_change',
  'user.impersonate',
  'org.create',
  'org.update',
  'org.delete',
  'org.member_add',
  'org.member_remove',
  'org.member_role_change',
  'app.register',
  'app.update',
  'app.delete',
  'webhook.register',
  'webhook.update',
  'webhook.delete',
  'grant.revoke',
] as const

export type AuditAction = (typeof ALL_AUDIT_ACTIONS)[number]

/** The shape returned by `list()` for the /admin/audit page. */
export type AuditLogRow = {
  id: string
  actorId: string | null
  actorRole: string | null
  actorEmail: string | null
  action: string
  targetType: string | null
  targetId: string | null
  payload: unknown
  ip: string | null
  userAgent: string | null
  occurredAt: Date
}
