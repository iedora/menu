import * as React from 'react'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbHere,
  BreadcrumbLink,
  Separator,
} from '@iedora/design-system'

/**
 * Standard shell for every dashboard page.
 *
 * Why one shell:
 *   - Every page was hand-rolling its own heading + spacing rhythm,
 *     which drifted from screen to screen. One primitive, one rhythm.
 *   - The sidebar already tells the user where they are, so root and
 *     1-level pages render just an `<h1>`. Breadcrumbs only show up
 *     when there are intermediate hops worth surfacing (2+ levels).
 *   - `<BreadcrumbHere>` doubles as the page's `<h1>` (SEO + a11y) so
 *     the title slot writes one piece of text, not two.
 *
 * Shapes:
 *
 *   Flat page (Billing, Analytics, Home, …):
 *
 *     <DashboardPage title="Billing" data-test-id="billing">
 *       …sections…
 *     </DashboardPage>
 *     ↓  Billing                          [actions]
 *
 *   Nested page with intermediate hops:
 *
 *     <DashboardPage
 *       title="Sessions (admin)"
 *       crumbs={[{ label: 'Admin', href: '/dashboard/admin/qr-codes' }]}
 *       data-test-id="sessions-admin"
 *     >
 *     ↓  ADMIN / *Sessions (admin)*       [actions]
 *
 * Mobile-first: the header row collapses (actions wrap below at narrow
 * widths) and the children rhythm stays consistent.
 */

export type DashboardCrumb = {
  label: React.ReactNode
  href: string
  /** Used for the per-crumb data-test-id suffix. Falls back to index. */
  testId?: string
}

export type DashboardPageProps = {
  /**
   * Intermediate breadcrumb items between the sidebar and the current
   * page title. Defaults to `[]` — when empty the title renders as a
   * plain `<h1>` (the sidebar's active link is enough context).
   */
  crumbs?: ReadonlyArray<DashboardCrumb>
  /** Renders as <BreadcrumbHere> (h1). The page heading. */
  title: React.ReactNode
  /** Optional mono-caps line above the heading row. */
  eyebrow?: React.ReactNode
  /** Optional editorial paragraph under the heading row. */
  description?: React.ReactNode
  /** Right-aligned slot for primary actions (links, buttons, filters). */
  actions?: React.ReactNode
  /** Page sections. */
  children: React.ReactNode
  /** Forwarded to the outer wrapper + namespaces all auto test-ids. */
  'data-test-id'?: string
}

export function DashboardPage({
  crumbs = [],
  title,
  eyebrow,
  description,
  actions,
  children,
  'data-test-id': testId,
}: DashboardPageProps) {
  const ns = (suffix: string) => (testId ? `${testId}-${suffix}` : undefined)
  const showHeaderRow = Boolean(eyebrow || description || actions)
  const hasTrail = crumbs.length > 0

  return (
    <div className="space-y-6" data-test-id={testId}>
      {/* Below `lg` the sidebar trigger floats in the top-right corner
          over this region — reserve 56px of right padding so long titles
          don't slide under the button. At `lg+` the rail takes over and
          the trigger is hidden, so the padding drops away. */}
      <div className="space-y-4 pr-14 lg:pr-0">
        {hasTrail ? (
          <Breadcrumb data-test-id={ns('breadcrumbs')}>
            {crumbs.map((c, i) => (
              <BreadcrumbLink
                key={c.href}
                asChild
                data-test-id={ns(`breadcrumb-${c.testId ?? i}`)}
              >
                <Link href={c.href}>{c.label}</Link>
              </BreadcrumbLink>
            ))}
            <BreadcrumbHere data-test-id={ns('breadcrumb-current')}>
              {title}
            </BreadcrumbHere>
          </Breadcrumb>
        ) : (
          // Flat page: the sidebar's active link tells the user where
          // they are, so a one-hop "Home / X" trail would be noise.
          // Title renders as `<h1>` styled like `BreadcrumbHere` so the
          // typography matches.
          <h1
            className="ds-breadcrumb__here"
            data-test-id={ns('heading')}
          >
            {title}
          </h1>
        )}

        {showHeaderRow && (
          <header
            className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
            data-test-id={ns('header')}
          >
            <div className="space-y-2 min-w-0">
              {eyebrow ? (
                <div className="eyebrow" data-test-id={ns('eyebrow')}>
                  {eyebrow}
                </div>
              ) : null}
              {description ? (
                <p
                  className="max-w-prose text-sm text-[var(--ink-70)]"
                  data-test-id={ns('description')}
                >
                  {description}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div
                className="flex flex-wrap items-center gap-3 sm:justify-end"
                data-test-id={ns('actions')}
              >
                {actions}
              </div>
            ) : null}
          </header>
        )}
      </div>

      <Separator />

      <div className="space-y-8">
        {children}
      </div>
    </div>
  )
}
