import 'server-only'
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import { db } from '@/shared/db/client'
import { auditLog, user } from '@/shared/db/schema'
import type {
  AuditCursor,
  AuditListQuery,
  AuditReader,
  AuditRowInput,
  AuditWriter,
} from '../ports'
import type { AuditLogRow } from '../types'

/**
 * Drizzle-backed implementation of the audit ports. One INSERT per
 * `record`, one SELECT with a left-join on `user` per `list`. The writer
 * does NOT swallow errors — the caller is expected to surface a failure
 * to the admin so audit fidelity stays intact.
 */
export const drizzleAuditWriter: AuditWriter = {
  async record(row: AuditRowInput) {
    await db.insert(auditLog).values({
      id: row.id,
      actorId: row.actorId,
      actorRole: row.actorRole,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      // Drizzle's pg-jsonb column accepts plain JS values; postgres-js will
      // JSON.stringify them at the wire boundary.
      payload: row.payload ?? null,
      ip: row.ip,
      userAgent: row.userAgent,
      occurredAt: row.occurredAt,
    })
  },
}

export const drizzleAuditReader: AuditReader = {
  async list(query: AuditListQuery) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200)

    // Build the filter conjunction. Each filter is undefined-safe so the
    // composed where stays narrow.
    const conditions = []

    if (query.actorEmail && query.actorEmail.trim().length > 0) {
      conditions.push(ilike(user.email, `%${query.actorEmail.trim()}%`))
    }
    if (query.actions && query.actions.length > 0) {
      conditions.push(inArray(auditLog.action, query.actions))
    }
    if (query.targetType && query.targetType.length > 0) {
      conditions.push(eq(auditLog.targetType, query.targetType))
    }
    if (query.targetId && query.targetId.trim().length > 0) {
      conditions.push(ilike(auditLog.targetId, `%${query.targetId.trim()}%`))
    }
    if (query.since) {
      conditions.push(gte(auditLog.occurredAt, query.since))
    }
    if (query.until) {
      conditions.push(lte(auditLog.occurredAt, query.until))
    }

    // Keyset cursor: WHERE (occurred_at, id) < (cursor.occurredAt, cursor.id)
    // expressed in row-value form so the index on (occurred_at) is usable
    // and ties break deterministically on id.
    if (query.cursor) {
      conditions.push(
        or(
          lt(auditLog.occurredAt, query.cursor.occurredAt),
          and(
            eq(auditLog.occurredAt, query.cursor.occurredAt),
            lt(auditLog.id, query.cursor.id),
          ),
        )!,
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Fetch limit+1 rows: the extra row is consumed to compute the next
    // cursor without re-querying.
    const rows = await db
      .select({
        id: auditLog.id,
        actorId: auditLog.actorId,
        actorRole: auditLog.actorRole,
        actorEmail: user.email,
        action: auditLog.action,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        payload: auditLog.payload,
        ip: auditLog.ip,
        userAgent: auditLog.userAgent,
        occurredAt: auditLog.occurredAt,
      })
      .from(auditLog)
      .leftJoin(user, eq(user.id, auditLog.actorId))
      .where(whereClause)
      .orderBy(desc(auditLog.occurredAt), desc(auditLog.id))
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const last = page[page.length - 1]
    const nextCursor: AuditCursor | null =
      hasMore && last ? { occurredAt: last.occurredAt, id: last.id } : null

    return {
      rows: page.map(
        (r): AuditLogRow => ({
          id: r.id,
          actorId: r.actorId,
          actorRole: r.actorRole,
          actorEmail: r.actorEmail,
          action: r.action,
          targetType: r.targetType,
          targetId: r.targetId,
          payload: r.payload,
          ip: r.ip,
          userAgent: r.userAgent,
          occurredAt: r.occurredAt,
        }),
      ),
      nextCursor,
    }
  },
}

/**
 * Distinct list of `target_type` values currently present in the table.
 * Used by the /admin/audit page to populate the target-type filter without
 * hard-coding the full list (new prefixes added in `types.ts` show up
 * automatically once they've been recorded at least once).
 *
 * Kept small with a hard limit since the cardinality is bounded by the
 * `AuditEvent` union (currently 5 distinct target_types).
 */
export async function listKnownTargetTypes(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ targetType: auditLog.targetType })
    .from(auditLog)
    .where(sql`${auditLog.targetType} IS NOT NULL`)
    .limit(50)
  return rows
    .map((r) => r.targetType)
    .filter((t): t is string => typeof t === 'string')
    .sort()
}
