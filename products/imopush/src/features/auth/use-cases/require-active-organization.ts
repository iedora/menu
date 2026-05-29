import 'server-only'
import { redirect } from 'next/navigation'
import type { AuthGateway } from '../ports'
import { verifySession } from './verify-session'
import { IMOPUSH_PATHS } from '../../../url'

export async function requireActiveOrganization(auth: AuthGateway) {
  const session = await verifySession(auth)
  const tenantId = session.session.activeTenantId
  if (!tenantId) redirect(IMOPUSH_PATHS.onboarding)
  return { session, tenantId }
}
