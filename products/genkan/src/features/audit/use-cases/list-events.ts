import type { AuditCursor, AuditListQuery, AuditReader } from '../ports'
import type { AuditLogRow } from '../types'

export type AuditListResult = {
  rows: AuditLogRow[]
  nextCursor: AuditCursor | null
}

/**
 * Thin pass-through over the reader. Exists as a use-case so a fake
 * reader in tests can validate the shape of the query the page builds
 * (e.g. that the `since` date is anchored correctly for a "last 7 days"
 * filter).
 */
export async function listEvents(
  reader: AuditReader,
  query: AuditListQuery,
): Promise<AuditListResult> {
  return reader.list(query)
}
