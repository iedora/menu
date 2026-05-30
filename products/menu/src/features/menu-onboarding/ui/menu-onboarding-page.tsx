'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { DottedStepper, Masthead, OrnamentRule, PaperCard, Stage } from '@iedora/design-system'
import { MenuImportWizard } from '../../menu-import/ui/menu-import-wizard'

/**
 * Step 2 chrome — paper-card masthead + dotted stepper + ornament,
 * then the AI import wizard inline plus a Skip escape hatch.
 *
 * All page chrome (Stage, PaperCard, Masthead, OrnamentRule,
 * DottedStepper) comes from @iedora/design-system primitives so the
 * onboarding flow stays in lockstep with every other paper-card
 * surface. What's left here is the slice's own composition: the lede
 * copy, the wizard mount with its CSS override, the Skip linkbtn,
 * and the undernote.
 *
 * Form-specific classes (`onb-lede`, `onb-wizard-mount`, `onb-linkbtn`,
 * `onb-undernote`) live in `apps/web/src/app/menu/onboarding/onboarding.css`
 * — imported by the route entry that renders this component.
 *
 * Success path: `<MenuImportWizard onImported />` fires once the menu
 * has been persisted; we redirect straight to `/dashboard` (instead of
 * the menu builder, which would push the operator into a chrome they
 * haven't seen yet).
 */
export function MenuOnboardingPage({
  slug,
  restaurantId,
  initialQuota,
  unlimited,
  onComplete,
}: {
  slug: string
  restaurantId: string
  initialQuota?: { used: number; limit: number }
  unlimited?: boolean
  /**
   * Fired before the dashboard redirect on both completion paths
   * (Skip + AI import). The route entry passes the server action
   * that flips `restaurant.onboarding_completed_at` so the resume
   * gate at `/menu/onboarding` stops bouncing this user back into
   * the wizard. Optional so unit tests keep working without a fake.
   */
  onComplete?: () => Promise<void>
}) {
  const t = useTranslations('Onboarding')
  const tMenu = useTranslations('Onboarding.menu')
  const router = useRouter()

  async function goToDashboard() {
    if (onComplete) {
      try {
        await onComplete()
      } catch (err) {
        // Best-effort: a flag-write failure must not block the
        // redirect. The operator gets a stale resume bounce next
        // time at worst; surface in the console for ops visibility.
        console.error('[menu-onboarding] markComplete failed', err)
      }
    }
    router.push('/menu/dashboard')
    router.refresh()
  }

  return (
    <Stage data-test-id="menu-onboarding-page">
      <PaperCard data-test-id="menu-onboarding-card">
        <Masthead course={tMenu('eyebrow')} />
        <DottedStepper
          steps={[
            { key: 'name', index: 1, label: t('steps.name') },
            { key: 'menu', index: 2, label: t('steps.menu') },
          ]}
          currentKey="menu"
          ariaLabel={t('steps.label')}
          counterLabel={t('steps.counter', { index: 2, total: 2 })}
          testId="menu-onboarding-stepper"
          stepTestId={(key) => `menu-onboarding-stepper-step-${key}`}
        />
        <OrnamentRule fleuron="❧" />

        <div className="onb-lede">
          <h1 data-test-id="menu-onboarding-title">{tMenu('title')}</h1>
          <p data-test-id="menu-onboarding-subtitle">
            {tMenu('subtitle')} <em>{tMenu('subtitleAside')}</em>
          </p>
        </div>

        <div className="onb-wizard-mount">
          <MenuImportWizard
            slug={slug}
            restaurantId={restaurantId}
            initialQuota={initialQuota}
            unlimited={unlimited}
            offerSetDefaultLanguage
            onImported={goToDashboard}
            extraActions={
              <button
                type="button"
                className="onb-linkbtn"
                onClick={goToDashboard}
                data-test-id="menu-onboarding-skip"
              >
                {tMenu('skip')}
              </button>
            }
          />
        </div>

        <p
          className="onb-undernote"
          data-test-id="menu-onboarding-skip-hint"
        >
          {tMenu('skipHint')}
        </p>
      </PaperCard>
    </Stage>
  )
}
