'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { CORE_AUDIT_EVENTS, recordAudit } from '@iedora/auth'
import { actorFromSession } from '@iedora/auth/server'
import { requireScope } from '../../guards'
import { SCOPES } from '@iedora/auth/scopes'
import { betterAuthAdminSessionsGateway } from './adapters/better-auth'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function revokeSessionAction(input: {
  sessionToken: string
}): Promise<ActionResult> {
  const session = await requireScope(SCOPES.core.staff.sessions.revoke)
  const gateway = betterAuthAdminSessionsGateway()
  await gateway.revokeSession({ sessionToken: input.sessionToken })
  await recordAudit({
    event: CORE_AUDIT_EVENTS.SESSION_REVOKED,
    outcome: 'success',
    actor: actorFromSession(session),
    headers: await headers(),
    important: true,
  })
  revalidatePath('/core/admin/sessions')
  return { ok: true }
}
