import 'server-only'
import { headers } from 'next/headers'
import { drizzleAuditReader, drizzleAuditWriter } from './adapters/drizzle'
import { recordEvent } from './use-cases/record-event'
import { listEvents, type AuditListResult } from './use-cases/list-events'
import type { AuditListQuery } from './ports'
import type { AuditContext, AuditEvent } from './types'

/**
 * Extract the audit context from the current request headers. Genkan sits
 * behind Cloudflare in production, so `cf-connecting-ip` is the trustworthy
 * source — `x-forwarded-for` is fallback for non-CF deployments and tests.
 * The session is passed in by the caller because session lookup APIs vary
 * across action shapes (some already call `requireAdmin()`, which returns
 * the session).
 */
export function getRequestContext(
  req: Headers,
  actor?: { id: string | null; role: string | null },
): AuditContext {
  const ip =
    req.get('cf-connecting-ip') ??
    req.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
  const userAgent = req.get('user-agent') ?? null
  return {
    actorId: actor?.id ?? null,
    actorRole: actor?.role ?? null,
    ip,
    userAgent,
  }
}

/**
 * Append one audit event using the production Drizzle writer. Called from
 * every admin / identity action after the underlying mutation has succeeded.
 *
 * Errors propagate to the caller — losing audit fidelity is a worse
 * failure mode than the originating action visibly erroring, and the
 * surrounding action shape is `Result = { ok, error }` so the operator
 * gets a clean failure message.
 *
 * The caller is expected to log + re-raise (or convert to a `Result`
 * failure) so the error surfaces in the admin UI. See the action files
 * in `app/admin/**` for the standard pattern.
 */
export async function record(
  event: AuditEvent,
  ctx: AuditContext,
): Promise<void> {
  try {
    await recordEvent(drizzleAuditWriter, event, ctx)
  } catch (e) {
    console.error('[audit] failed to record event', {
      action: event.action,
      targetId: event.targetId,
      err: e,
    })
    throw e
  }
}

/**
 * Convenience wrapper: read the request context off `next/headers` and
 * append in one call. Use this from server actions that have already
 * verified the actor (via `requireAdmin()` or similar) — pass the
 * already-resolved actor.
 */
export async function recordFromRequest(
  event: AuditEvent,
  actor?: { id: string | null; role: string | null },
): Promise<void> {
  const ctx = getRequestContext(await headers(), actor)
  await record(event, ctx)
}

/** Read use-case wired to the production reader. */
export async function list(query: AuditListQuery): Promise<AuditListResult> {
  return listEvents(drizzleAuditReader, query)
}
