import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import {
  Sidebar,
  SidebarBrand,
  SidebarClose,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
  Wordmark,
} from '@iedora/design-system'
import {
  getEffectiveOrganizationId,
  getSession,
  IEDORA_ADMIN_ROLE,
  SCOPES,
} from '@/features/auth'
import { getOrganizationPlan, planHas } from '@/features/plans'
import { LogoutButton } from '@/features/dashboard-home/ui/logout-button'
import { UserLocaleSwitcher } from '@/features/dashboard-home/ui/user-locale-switcher'
import {
  ActiveSidebarLinks,
  type ActiveSidebarItem,
} from '@/shared/ui/active-sidebar-links'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Soft fetches only — layouts don't re-render on navigation in Next 16, so
  // a stale `redirect()` here would leak across pages. Real gating lives in
  // the per-page DAL guards (`verifySession`, `requireActiveOrganization`).
  const session = await getSession()
  const organizationId = session?.user
    ? await getEffectiveOrganizationId(session.user.id)
    : null
  const plan = organizationId
    ? await getOrganizationPlan(organizationId)
    : null
  const showAnalyticsLink = plan ? planHas(plan, 'analytics') : false
  const showAdminLink =
    session?.user.permissions.includes(SCOPES.QR_CODES_READ) ?? false
  const showSessionsLink =
    session?.user.roles.includes(IEDORA_ADMIN_ROLE) ?? false

  const t = await getTranslations('AppHeader')
  const nav = await getTranslations('DashboardNav')

  // Primary nav: Home + Billing + Analytics; secondary "Admin" group
  // hosts the cross-tenant tools (QR Codes + Sessions). `Home` is opt-out
  // of prefix matching so it doesn't light up under every nested route.
  const hasAdminGroup = showAdminLink || showSessionsLink
  const candidates: ReadonlyArray<ActiveSidebarItem | false> = [
    { href: '/dashboard', label: nav('home'), testId: 'dashboard-nav-home', matchPrefix: false },
    showAnalyticsLink && { href: '/dashboard/analytics', label: nav('analytics'), testId: 'dashboard-nav-analytics' },
    { href: '/dashboard/billing', label: nav('billing'), testId: 'dashboard-nav-billing' },
    hasAdminGroup && { kind: 'section', label: nav('admin'), testId: 'dashboard-nav-admin-section' },
    showAdminLink && { href: '/dashboard/admin/qr-codes', label: nav('qrCodes'), testId: 'dashboard-nav-admin' },
    showSessionsLink && { href: '/dashboard/admin/sessions', label: nav('sessions'), testId: 'dashboard-nav-sessions' },
  ]
  const navItems = candidates.filter((x): x is ActiveSidebarItem => Boolean(x))

  return (
    <SidebarProvider>
      <div className="flex min-h-screen flex-col bg-[var(--paper)] lg:flex-row">
        {/* Hamburger floats top-left below `lg`, hidden at desktop. No
            dedicated mobile bar — the page content claims the full
            viewport and the button overlays it. */}
        <SidebarTrigger
          aria-label={t('openNavigation')}
          data-test-id="dashboard-sidebar-trigger"
        />

        <Sidebar aria-label={nav('ariaLabel')} data-test-id="dashboard-chrome">
          <SidebarClose
            aria-label={t('closeNavigation')}
            data-test-id="dashboard-sidebar-close"
          />
          <SidebarBrand>
            <Link
              href="/dashboard"
              className="brand"
              aria-label={t('brandHome')}
              data-test-id="dashboard-home-link"
            >
              <Wordmark word="menu" variant="inline" className="ds-wordmark--reveal" />
            </Link>
          </SidebarBrand>

          {/* `ActiveSidebarLinks` is a tiny client island over
              `<SidebarLinks>` — reads `usePathname()` once and maps
              to `<SidebarLink asChild active=…><Link/></SidebarLink>`
              so client-side routing + prefetch stay intact AND the
              cinnabar rail lights the right item. */}
          <ActiveSidebarLinks ariaLabel={nav('ariaLabel')} items={navItems} />

          <SidebarFooter>
            <UserLocaleSwitcher />
            {session?.user && (
              <span
                className="min-w-0 truncate font-[family-name:var(--mono)] text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-40)]"
                title={session.user.email}
                data-test-id="dashboard-user-email"
              >
                {session.user.email}
              </span>
            )}
            <LogoutButton />
          </SidebarFooter>
        </Sidebar>

        <main className="ds-shell flex-1 pt-5 pb-10 sm:pt-7 sm:pb-14 lg:pt-8 lg:pb-16">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}
