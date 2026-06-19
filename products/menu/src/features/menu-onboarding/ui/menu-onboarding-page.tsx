'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { seedSampleMenu } from '../../menu-builder/actions'

/** Inline icons (the slice doesn't depend on lucide-react). */
type IconProps = { size?: number; className?: string; strokeWidth?: number }
const svgBase = (size: number, className?: string, sw = 2) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: sw,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true,
})
function Sparkles({ size = 20, className, strokeWidth }: IconProps) {
  return (
    <svg {...svgBase(size, className, strokeWidth)} fill="currentColor" stroke="none">
      <path d="M12 2l1.8 5.5L19.5 9l-5.7 1.5L12 16l-1.8-5.5L4.5 9l5.7-1.5z" />
    </svg>
  )
}
function PencilLine({ size = 20, className, strokeWidth }: IconProps) {
  return (
    <svg {...svgBase(size, className, strokeWidth)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}
function ChevronRight({ size = 20, className, strokeWidth }: IconProps) {
  return (
    <svg {...svgBase(size, className, strokeWidth)}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
function Phone({ size = 16, className, strokeWidth }: IconProps) {
  return (
    <svg {...svgBase(size, className, strokeWidth)}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  )
}

/**
 * Step 2 of onboarding — first-menu choice, in the warm-light "menu"
 * design that matches step 1 (Pencil `iedora.pen`). Mobile-first, big
 * tap targets, plain words for 50+ owners: pick a ready-made sample
 * menu (primary) or start from a blank one. The seed/skip server flow
 * is behaviour-preserving.
 */
export function MenuOnboardingPage({
  slug,
  onComplete,
}: {
  slug: string
  /**
   * Fired before the redirect on both completion paths (Seed + Skip).
   * The route entry passes the server action that flips
   * `restaurant.onboarding_completed_at` so the resume gate at
   * `/menu/onboarding` stops bouncing this user back into the wizard.
   * Optional so unit tests keep working without a fake.
   */
  onComplete?: () => Promise<void>
}) {
  const tMenu = useTranslations('Onboarding.menu')
  const tSupport = useTranslations('Onboarding')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  async function complete() {
    if (onComplete) {
      try {
        await onComplete()
      } catch (err) {
        // Best-effort: a flag-write failure must not block the redirect.
        console.error('[menu-onboarding] markComplete failed', err)
      }
    }
  }

  function seed() {
    startTransition(async () => {
      const res = await seedSampleMenu(slug)
      await complete()
      if ('ok' in res) {
        router.push(`/menu/dashboard/r/${slug}/m/${res.menuId}`)
      } else {
        router.push('/menu/dashboard')
      }
      router.refresh()
    })
  }

  function skip() {
    startTransition(async () => {
      await complete()
      router.push('/menu/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground" data-test-id="menu-onboarding-page">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-7">
        {/* Progress — step 2 of 2 (complete) */}
        <div className="mb-9 flex items-center gap-3" aria-label="Onboarding progress">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-full rounded-full bg-primary" />
          </div>
          <span className="text-[13px] font-semibold text-muted-foreground" data-test-id="menu-onboarding-stepper">
            2/2
          </span>
        </div>

        <h1
          className="font-[family-name:var(--display)] text-[28px] font-extrabold leading-[1.12] tracking-[-0.01em] text-foreground"
          data-test-id="menu-onboarding-title"
        >
          {tMenu('title')}
        </h1>
        <p className="mt-2 text-[15px] leading-[1.5] text-muted-foreground" data-test-id="menu-onboarding-subtitle">
          {tMenu('subtitle')}
        </p>

        <div className="mt-8 flex flex-col gap-3.5">
          {/* Sample menu — recommended */}
          <button
            type="button"
            onClick={seed}
            disabled={pending}
            data-test-id="menu-onboarding-seed"
            className="flex items-center gap-4 rounded-[18px] border-2 border-primary bg-[var(--cinnabar-soft)] p-5 text-left transition-opacity disabled:opacity-60"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white">
              <Sparkles size={20} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-[family-name:var(--display)] text-[17px] font-bold text-foreground">{tMenu('sample')}</span>
              <span className="mt-0.5 block text-[13.5px] leading-[1.45] text-muted-foreground">{tMenu('sampleHint')}</span>
            </span>
            <ChevronRight size={20} className="shrink-0 text-primary" />
          </button>

          {/* Start blank */}
          <button
            type="button"
            onClick={skip}
            disabled={pending}
            data-test-id="menu-onboarding-skip"
            className="flex items-center gap-4 rounded-[18px] border border-border bg-card p-5 text-left transition-colors hover:border-[color-mix(in_srgb,var(--cinnabar)_40%,transparent)] disabled:opacity-60"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
              <PencilLine size={20} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-[family-name:var(--display)] text-[17px] font-bold text-foreground">{tMenu('manual')}</span>
              <span className="mt-0.5 block text-[13.5px] leading-[1.45] text-muted-foreground" data-test-id="menu-onboarding-skip-hint">{tMenu('manualHint')}</span>
            </span>
            <ChevronRight size={20} className="shrink-0 text-muted-foreground" />
          </button>
        </div>

        <a
          href="tel:+351917140356"
          className="mt-auto flex items-center justify-center gap-2 pt-8 text-[14px] text-muted-foreground no-underline"
          data-test-id="menu-onboarding-support"
        >
          <Phone size={15} strokeWidth={2} /> {tSupport('support')}{' '}
          <span className="font-semibold text-primary">+351 917 140 356</span>
        </a>
      </div>
    </div>
  )
}
