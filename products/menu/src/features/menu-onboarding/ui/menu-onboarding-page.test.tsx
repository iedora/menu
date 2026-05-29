// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../i18n/messages/en.json'
import { MenuOnboardingPage } from './menu-onboarding-page'

// The wizard reaches the menu-import + upload server actions; stub them
// so jsdom never tries to import 'server-only'.
vi.mock('@/features/menu-import/actions', () => ({
  analyzeMenuImage: vi.fn(),
  importMenuFromParsed: vi.fn(),
}))
vi.mock('@/features/upload/actions', () => ({
  requestUploadUrl: vi.fn(),
  commitAsset: vi.fn(),
}))
// `useRouter` requires the Next app-router context, which static SSR
// rendering doesn't provide. Stub with a noop.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

function renderWithIntl(node: React.ReactNode) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      {node}
    </NextIntlClientProvider>,
  )
}

describe('MenuOnboardingPage', () => {
  const props = { slug: 'tasca', restaurantId: 'r-1' } as const

  it('renders the masthead + stepper + lede with the right test hooks', () => {
    const html = renderWithIntl(<MenuOnboardingPage {...props} />)
    expect(html).toContain('data-test-id="menu-onboarding-page"')
    expect(html).toContain('data-test-id="menu-onboarding-card"')
    expect(html).toContain('class="ds-masthead__word"')
    expect(html).toContain('data-test-id="menu-onboarding-stepper"')
    expect(html).toContain('data-test-id="menu-onboarding-stepper-step-name"')
    expect(html).toContain('data-test-id="menu-onboarding-stepper-step-menu"')
    expect(html).toContain('data-test-id="menu-onboarding-stepper-counter"')
    expect(html).toContain('data-test-id="menu-onboarding-title"')
    expect(html).toContain('data-test-id="menu-onboarding-subtitle"')
    expect(html).toContain(`>${en.Onboarding.menu.title}</h1>`)
  })

  it('marks step 1 (Name) as done and step 2 (Menu) as current', () => {
    const html = renderWithIntl(<MenuOnboardingPage {...props} />)
    expect(html).toContain('ds-dstepper__node--done')
    expect(html).toContain('ds-dstepper__node--current')
  })

  it('hosts the AI wizard at the upload step on first render with both camera and upload paths', () => {
    const html = renderWithIntl(<MenuOnboardingPage {...props} />)
    expect(html).toContain('data-test-id="menu-import-wizard-upload"')
    expect(html).toContain('data-test-id="menu-import-take-photo"')
    expect(html).toContain('data-test-id="menu-import-upload-photo"')
    expect(html).not.toContain('data-test-id="menu-import-wizard-preview"')
    expect(html).not.toContain('data-test-id="menu-import-wizard-camera"')
  })

  it('exposes a Skip control inline next to the wizard', () => {
    const html = renderWithIntl(<MenuOnboardingPage {...props} />)
    expect(html).toContain('data-test-id="menu-onboarding-skip"')
    expect(html).toContain('Skip')
    expect(html).toContain('add dishes manually')
    expect(html).toContain('data-test-id="menu-onboarding-skip-hint"')
    expect(html).toContain(en.Onboarding.menu.skipHint)
  })
})
