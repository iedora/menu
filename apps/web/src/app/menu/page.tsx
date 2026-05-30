import { redirect } from 'next/navigation'
import { isStaffRole } from '@iedora/auth/role-presets'
import { getEffectiveOrganizationId, getSession } from '@iedora/product-menu/features/auth'
import { ONBOARDING_STEPS } from '@iedora/product-menu/features/menu-onboarding'
import LandingPage from './_components/landing/landing-page'

export default async function Home() {
  const session = await getSession()
  if (session) {
    // Staff (iedora-admin / iedora-support) are cross-tenant operators
    // and don't need to belong to a tenant to use the dashboard —
    // skip the onboarding redirect for them.
    const role = (session.user as { role?: string | null }).role ?? null
    const tenantId = await getEffectiveOrganizationId()
    if (!tenantId && !isStaffRole(role)) {
      redirect(ONBOARDING_STEPS.name.path)
    }
    redirect('/menu/dashboard')
  }
  return <LandingPage />
}
