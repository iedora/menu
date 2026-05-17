import type { AuditAction, AuditLogRow } from './types'

/**
 * Single side-effect interface for the audit slice. The production
 * implementation lives in `adapters/drizzle.ts`; tests can pass a fake.
 *
 * Both methods are intentionally narrow:
 *   - `record` takes a fully-resolved row so the use-case stays pure
 *     (timestamping + id generation are the use-case's job).
 *   - `list` exposes only the filters the admin UI actually offers.
 */
export interface AuditWriter {
  record(row: AuditRowInput): Promise<void>
}

export interface AuditReader {
  list(query: AuditListQuery): Promise<{
    rows: AuditLogRow[]
    nextCursor: AuditCursor | null
  }>
}

export type AuditRowInput = {
  id: string
  actorId: string | null
  actorRole: string | null
  action: string
  targetType: string | null
  targetId: string | null
  payload: unknown
  ip: string | null
  userAgent: string | null
  occurredAt: Date
}

/**
 * Cursor for keyset pagination. We order by (occurred_at desc, id desc)
 * so a stable cursor is the (occurred_at, id) of the last row seen.
 */
export type AuditCursor = {
  occurredAt: Date
  id: string
}

export type AuditListQuery = {
  /** Substring match on the actor's email (case-insensitive). */
  actorEmail?: string
  /** Multi-select on the action literal. */
  actions?: AuditAction[]
  /** Exact match on the target_type column. */
  targetType?: string
  /** Substring match on `target_id`. */
  targetId?: string
  /** Inclusive lower bound on `occurred_at`. */
  since?: Date
  /** Exclusive upper bound on `occurred_at`. */
  until?: Date
  /** Page size — default 50, capped at 200. */
  limit?: number
  /** Cursor returned by a previous call. */
  cursor?: AuditCursor | null
}
