import 'server-only'

/**
 * Public API of the audit slice. Every admin / identity action imports
 * `record` (or `recordFromRequest`) from here after its underlying mutation
 * succeeds; the /admin/audit page calls `list()` to render the trail.
 *
 * Two failure modes the callers need to know about:
 *   - `record()` throws on DB error. The action should convert that into a
 *     `{ ok: false, error }` so the operator sees the failure.
 *   - `list()` is a plain read — no auth check here. The page is gated by
 *     `requireAdmin()` upstream.
 */
export {
  record,
  recordFromRequest,
  list,
  getRequestContext,
} from './sender'

export { listKnownTargetTypes } from './adapters/drizzle'

export type {
  AuditEvent,
  AuditAction,
  AuditContext,
  AuditLogRow,
} from './types'
export { ALL_AUDIT_ACTIONS, targetTypeFor } from './types'
export type {
  AuditCursor,
  AuditListQuery,
  AuditReader,
  AuditWriter,
  AuditRowInput,
} from './ports'
export type { AuditListResult } from './use-cases/list-events'
