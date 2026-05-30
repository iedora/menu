import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { DottedStepper, Masthead, OrnamentRule, PaperCard, Stage } from '@iedora/design-system'
import { isStaffRole } from '@iedora/auth/role-presets'
import {
  getEffectiveOrganizationId,
  getSession,
} from '@iedora/product-menu/features/auth'
import {
  ADD_ANOTHER_QUERY_KEY,
  ADD_ANOTHER_QUERY_VALUE,
  ONBOARDING_STEPS,
  findPendingOnboardingRestaurant,
  tenantHasRestaurant,
} from '@iedora/product-menu/features/menu-onboarding'
import { signInUrl } from '@iedora/product-core/url'
import { publicUrl } from '@iedora/product-menu/shared/url'
import { OnboardingForm } from './onboarding-form'
import './onboarding.css'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const session = await getSession()
  if (!session?.user) redirect(signInUrl(publicUrl(ONBOARDING_STEPS.name.path).toString()))

  // Staff bypass: iedora-admin / iedora-support never need to onboard
  // a tenant of their own — the dashboard is cross-tenant for them.
  const role = (session.user as { role?: string | null }).role ?? null
  if (isStaffRole(role)) redirect('/menu/dashboard')

  const sp = (await searchParams) ?? {}
  const addAnotherRaw = sp[ADD_ANOTHER_QUERY_KEY]
  const addAnother =
    (Array.isArray(addAnotherRaw) ? addAnotherRaw[0] : addAnotherRaw) ===
    ADD_ANOTHER_QUERY_VALUE

  // Tier the gate by the active tenant's state:
  //   - no tenant pinned             → first-time user, render step 1
  //   - tenant has a pending wizard  → resume into step 2
  //   - tenant has only completions  → bounce to dashboard unless the
  //                                    operator opted in via the
  //                                    dashboard CTA (`?addAnother=1`)
  const tenantId = await getEffectiveOrganizationId()
  if (tenantId) {
    const pending = await findPendingOnboardingRestaurant(tenantId)
    if (pending)
      redirect(ONBOARDING_STEPS.menu.buildPath({ slug: pending.slug }))
    if (!addAnother && (await tenantHasRestaurant(tenantId))) {
      redirect('/menu/dashboard')
    }
  }

  const t = await getTranslations('Onboarding')

  return (
    <Stage data-test-id="onboarding-name-page">
      <PaperCard data-test-id="onboarding-name-card">
        <Masthead course={t('eyebrow')} />
        <DottedStepper
          steps={[
            { key: 'name', index: 1, label: t('steps.name') },
            { key: 'menu', index: 2, label: t('steps.menu') },
          ]}
          currentKey="name"
          ariaLabel={t('steps.label')}
          counterLabel={t('steps.counter', { index: 1, total: 2 })}
          testId="onboarding-stepper"
          stepTestId={(key) => `onboarding-stepper-step-${key}`}
        />
        <OrnamentRule />
        <OnboardingForm />
      </PaperCard>
    </Stage>
  )
}
