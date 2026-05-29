import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import {
  ActiveSidebarLinks,
  type ActiveSidebarItem,
  Sidebar,
  SidebarBrand,
  SidebarClose,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
  Wordmark,
} from '@iedora/design-system'
import { signInUrl } from '@iedora/product-core/url'
import { ToastsProvider } from '@iedora/product-imopush/shared/ui/toasts'
import {
  getEffectiveOrganizationId,
  getSession,
} from '@iedora/product-imopush/features/auth'
import { IMOPUSH_PATHS } from '@iedora/product-imopush/url'

export default async function ImopushDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth gate — uniform across every dashboard descendant. Per-page DAL
  // (`requireActiveOrganization`) stays as belt-and-braces (it's the
  // source of truth for tenancy scoping, see CLAUDE.md rule 1).
  const session = await getSession()
  if (!session?.user) {
    redirect(signInUrl(`${IMOPUSH_PATHS.dashboard}`))
  }
  const tenantId = await getEffectiveOrganizationId()
  if (!tenantId) {
    redirect(IMOPUSH_PATHS.onboarding)
  }

  const nav = await getTranslations('Imopush.Nav')

  const navItems: ReadonlyArray<ActiveSidebarItem> = [
    {
      href: IMOPUSH_PATHS.dashboard,
      label: nav('properties'),
      testId: 'imopush-nav-properties',
      matchPrefix: false,
    },
    { kind: 'section', label: nav('integrators'), testId: 'imopush-nav-integrators-section' },
    {
      href: IMOPUSH_PATHS.integrator('idealista'),
      label: nav('idealista'),
      testId: 'imopush-nav-idealista',
    },
  ]

  return (
    <SidebarProvider>
      <ToastsProvider>
        <div className="flex min-h-screen flex-col bg-[var(--paper)] lg:flex-row">
          <SidebarTrigger
            aria-label={nav('ariaLabel')}
            data-test-id="imopush-sidebar-trigger"
          />
          <Sidebar aria-label={nav('ariaLabel')} data-test-id="imopush-chrome">
            <SidebarClose
              aria-label={nav('ariaLabel')}
              data-test-id="imopush-sidebar-close"
            />
            <SidebarBrand>
              <Link
                href={IMOPUSH_PATHS.dashboard}
                className="brand"
                aria-label={nav('ariaLabel')}
                data-test-id="imopush-home-link"
              >
                <Wordmark word="imopush" variant="inline" className="ds-wordmark--reveal" />
              </Link>
            </SidebarBrand>
            <ActiveSidebarLinks ariaLabel={nav('ariaLabel')} items={navItems} />
            <SidebarFooter />
          </Sidebar>
          <main className="ds-shell flex-1 pt-5 pb-10 sm:pt-7 sm:pb-14 lg:pt-8 lg:pb-16">
            {children}
          </main>
        </div>
      </ToastsProvider>
    </SidebarProvider>
  )
}
