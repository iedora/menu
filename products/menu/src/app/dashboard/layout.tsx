import Link from 'next/link'
import {
  Nav,
  NavActions,
  NavBrand,
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
import { ActiveNavLinks } from '@/shared/ui/active-nav-links'

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

  const navItems = [
    showAnalyticsLink && { href: '/dashboard/analytics', label: 'Analytics', testId: 'dashboard-nav-analytics' },
    { href: '/dashboard/billing', label: 'Billing', testId: 'dashboard-nav-billing' },
    showAdminLink && { href: '/dashboard/admin/qr-codes', label: 'Admin', testId: 'dashboard-nav-admin' },
    showSessionsLink && { href: '/dashboard/admin/sessions', label: 'Sessions', testId: 'dashboard-nav-sessions' },
  ].filter((x): x is { href: string; label: string; testId: string } => Boolean(x))

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <Nav sticky data-test-id="dashboard-chrome">
        <NavBrand>
          <Link
            href="/dashboard"
            className="brand"
            aria-label="Menu home"
            data-test-id="dashboard-home-link"
          >
            <Wordmark word="menu" variant="inline" className="ds-wordmark--reveal" />
          </Link>
        </NavBrand>

        {/* `ActiveNavLinks` is a tiny client island over `<NavLinks>` —
            reads `usePathname()` once and maps to `<NavLink asChild
            active=…><Link/></NavLink>` so client-side routing +
            prefetch stay intact AND the cinnabar active underline
            lights the right tab. */}
        <ActiveNavLinks ariaLabel="Dashboard" items={navItems} />

        <NavActions>
          <UserLocaleSwitcher />
          {session?.user && (
            <span
              className="hidden min-w-0 max-w-[22ch] truncate font-[family-name:var(--mono)] text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-40)] xl:inline"
              title={session.user.email}
              data-test-id="dashboard-user-email"
            >
              {session.user.email}
            </span>
          )}
          <LogoutButton />
        </NavActions>
      </Nav>

      <main className="ds-shell flex-1 py-6 sm:py-10 lg:py-12">{children}</main>
    </div>
  )
}
