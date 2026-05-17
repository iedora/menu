import 'server-only'
import { headers } from 'next/headers'
import { getRequestContext, record } from '@/features/audit'
import type { AuditEvent } from '@/features/audit'

type ActorInput =
  | { user: { id: string; role?: string | null } }
  | { id: string; role?: string | null }

function normalizeActor(actor: ActorInput): { id: string; role: string | null } {
  if ('user' in actor) {
    return { id: actor.user.id, role: actor.user.role ?? null }
  }
  return { id: actor.id, role: actor.role ?? null }
}

/**
 * Record one audit event from within an admin server action. Convenience
 * wrapper around `record()` that:
 *   - pulls the request context off `next/headers` for you,
 *   - returns a `{ ok, error }` so the caller can early-return without
 *     try/catch noise,
 *   - never silently swallows the error — the message surfaces in the UI.
 *
 * Standard usage right after the underlying mutation succeeds:
 *
 * ```ts
 * const auditResult = await recordAdminEvent(
 *   { action: 'user.ban', targetId: userId, payload: { reason } },
 *   session,
 * )
 * if (!auditResult.ok) return auditResult
 * ```
 */
export async function recordAdminEvent(
  event: AuditEvent,
  actor: ActorInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const reqHeaders = await headers()
  const a = normalizeActor(actor)
  try {
    await record(event, getRequestContext(reqHeaders, a))
    return { ok: true }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Audit log write failed.'
    return {
      ok: false,
      error: `Action completed but audit log write failed: ${message}. Investigate before re-running.`,
    }
  }
}
