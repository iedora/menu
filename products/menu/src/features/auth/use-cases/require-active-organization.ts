import 'server-only'
import { redirect } from 'next/navigation'
import { isStaffRole } from '@iedora/auth/role-presets'
import type { AuthGateway } from '../ports'
import { verifySession } from './verify-session'

/**
 * Guarantees an authenticated session AND a resolved tenantId.
 * Tenant users without an active org get bounced into /menu/onboarding
 * (first sign-in before they've created one).
 *
 * Staff (iedora-admin / iedora-support) without a tenant get bounced
 * back to /menu/dashboard — the onboarding flow doesn't apply to them
 * (their dashboard is cross-tenant). Pages that need a tenant should
 * either hide their sidebar entry for staff or render a "no tenant
 * pinned" empty state; the bounce here is the safety net for
 * type-the-URL cases.
 *
 * better-auth's organization plugin stores the active org on the
 * session row; the lookup is a single read.
 */
export async function requireActiveOrganization(auth: AuthGateway) {
  const session = await verifySession(auth)
  const tenantId = session.session.activeTenantId
  if (!tenantId) {
    if (isStaffRole(session.user.role)) {
      redirect('/menu/dashboard')
    }
    redirect('/menu/onboarding')
  }
  return { session, tenantId }
}
