import Link from 'next/link'
import { headers } from 'next/headers'
import { Wordmark } from '@iedora/design-system'
import { auth } from '@/features/auth/adapters/better-auth-instance'
import { getEffectiveOrganizationId } from '@/features/auth'
import { getOrganizationPlan, planHas } from '@/features/plans'
import { LogoutButton } from '@/features/dashboard-home/ui/logout-button'
import { UserLocaleSwitcher } from '@/features/dashboard-home/ui/user-locale-switcher'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Soft fetches only — layouts don't re-render on navigation in Next 16, so
  // a stale `redirect()` here would leak across pages. Real gating lives in
  // the per-page DAL guards (`verifySession`, `requireActiveOrganization`).
  // The layout only needs whatever data the chrome renders; missing values
  // collapse the relevant slots instead of throwing.
  const session = await auth.api.getSession({ headers: await headers() })
  const organizationId = session?.user
    ? await getEffectiveOrganizationId(
        session.user.id,
        session.session.activeOrganizationId,
      )
    : null
  const plan = organizationId
    ? await getOrganizationPlan(organizationId)
    : null
  const showAnalyticsLink = plan ? planHas(plan, 'analytics') : false

  const navLinkClass =
    "font-[family-name:var(--mono)] text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-55)] no-underline transition-colors hover:text-[var(--ink)]"

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      {/* Top MetaStrip — quiet brand context, locale + plan slot */}
      <div className="border-b border-[var(--ink-14)]">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-3 px-6 py-3 text-[10.5px] uppercase tracking-[0.18em] font-[family-name:var(--mono)] text-[var(--ink-55)]">
          <div className="flex items-center gap-3">
            <span>MMXXVI</span>
            <span aria-hidden="true">·</span>
            <span>iedora · menu</span>
          </div>
          <div className="flex items-center gap-3">
            <UserLocaleSwitcher />
          </div>
        </div>
      </div>

      {/* Wordmark + nav */}
      <header className="border-b border-[var(--ink-14)]">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-6 px-6 py-6">
          <Link
            href="/dashboard"
            className="inline-flex shrink-0 items-baseline no-underline"
            aria-label="Menu home"
          >
            <Wordmark
              word="menu"
              variant="inline"
              className="ds-wordmark--reveal"
            />
          </Link>
          <nav className="flex min-w-0 items-center gap-6">
            {showAnalyticsLink && (
              <Link
                href="/dashboard/analytics"
                data-testid="nav-analytics"
                className={navLinkClass}
              >
                Analytics
              </Link>
            )}
            <Link href="/dashboard/billing" className={navLinkClass}>
              Billing
            </Link>
            {session?.user && (
              <span
                className="hidden truncate font-[family-name:var(--mono)] text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-40)] sm:inline"
                title={session.user.email}
              >
                {session.user.email}
              </span>
            )}
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1320px] flex-1 px-6 py-12">
        {children}
      </main>
    </div>
  )
}
