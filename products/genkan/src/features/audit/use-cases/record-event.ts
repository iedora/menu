import { randomBytes } from 'node:crypto'
import type { AuditWriter } from '../ports'
import { targetTypeFor, type AuditContext, type AuditEvent } from '../types'

/**
 * Append one audit log row. Pure-ish — the only effect is the writer
 * (which production wires to Drizzle). The use-case:
 *   - generates the row id + timestamp here so tests are deterministic
 *     when the writer is a fake;
 *   - resolves `targetType` from the action via `targetTypeFor()`;
 *   - extracts `payload` if the event variant carries one;
 *   - DOES NOT catch errors — the sender wrapper decides the policy.
 *
 * Audit-log writes are best-effort but never swallowed. If the DB is
 * unreachable the originating action must fail too (see `sender.ts`).
 */
export async function recordEvent(
  writer: AuditWriter,
  event: AuditEvent,
  ctx: AuditContext,
  /** Optional overrides — tests pass a fixed id + clock. */
  overrides?: { id?: string; occurredAt?: Date },
): Promise<void> {
  const id = overrides?.id ?? generateAuditId()
  const occurredAt = overrides?.occurredAt ?? new Date()

  // Discriminated-union payload extraction. Variants without an explicit
  // `payload` (e.g. `user.unban`) record `null` — the column is nullable.
  const payload =
    'payload' in event
      ? (event as Extract<AuditEvent, { payload: unknown }>).payload
      : null

  await writer.record({
    id,
    actorId: ctx.actorId,
    actorRole: ctx.actorRole,
    action: event.action,
    targetType: targetTypeFor(event.action),
    targetId: event.targetId,
    payload,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    occurredAt,
  })
}

function generateAuditId(): string {
  // 12 bytes = 96 bits = ~2x birthday-collision room for 2^48 rows. Plenty
  // for an audit log; we'd rotate the table long before that.
  return `aud_${randomBytes(12).toString('hex')}`
}
