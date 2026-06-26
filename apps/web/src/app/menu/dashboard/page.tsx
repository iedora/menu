import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { getSession, isStaff, requireActiveOrganization } from '@iedora/product-menu/features/auth'
import { listRestaurantsWithCounts } from '@iedora/product-menu/features/dashboard-home'
import { getOrganizationMonthlyViews } from '@iedora/product-menu/features/metrics'
import { canAddRestaurant, getOrganizationPlan, planHas } from '@iedora/product-menu/features/plans'
import { addAnotherRestaurantHref } from '@iedora/product-menu/features/menu-onboarding'
import { Card, CardDesc, CardTitle } from '@iedora/ui/components/card'
import { DashboardPage as PageShell } from '@iedora/product-menu/shared/ui/dashboard-page'
import { ActionButton, RecordAction, RecordCard, StatCard } from '@iedora/product-menu/shared/ui/crm'
import { formatEditedAt, formatIndex } from '@iedora/product-menu/shared/ui/editorial-list'
import { AdminOverview } from './admin/_components/admin-overview'

/**
 * Owner dashboard home — a CRM that mirrors the staff admin overview: a row of
 * headline metrics, then the operator's restaurants as record cards (avatar +
 * name + quick actions). Deliberately simple and legible for non-technical
 * owners on a small phone (320px). The heavy analytics (chart, top dishes,
 * dwell time) live on the dedicated /analytics page, linked from the nav.
 */
export default async function DashboardPage() {
  // Staff get the cross-tenant CRM overview (the per-tenant owner home is
  // meaningless for them) — short-circuit before the tenant gate.
  const session = await getSession()
  if (isStaff(session)) {
    return <AdminOverview />
  }
  await requireActiveOrganization()

  const [t, tBilling, locale, restaurants, canAdd, plan, monthlyViews] = await Promise.all([
    getTranslations('Dashboard'),
    getTranslations('Billing'),
    getLocale(),
    listRestaurantsWithCounts(),
    canAddRestaurant(),
    getOrganizationPlan(),
    getOrganizationMonthlyViews(),
  ])

  const numberFmt = new Intl.NumberFormat(locale)
  const hasAnalytics = planHas(plan, 'analytics')
  // Monthly view quota (-1 = unlimited): the headline metric shows how many
  // views are left before the plan cap so an owner sees it at a glance.
  const unlimitedViews = plan.monthlyViews < 0
  const viewsRemaining = unlimitedViews ? 0 : Math.max(0, plan.monthlyViews - monthlyViews)
  const totalMenus = restaurants.reduce((n, r) => n + r.menuCount, 0)
  const totalDishes = restaurants.reduce((n, r) => n + r.dishCount, 0)
  const showIndex = restaurants.length > 1

  const actions = canAdd ? (
    <ActionButton href={addAnotherRestaurantHref()} data-test-id="dashboard-new-restaurant">
      {t('newRestaurant')}
    </ActionButton>
  ) : (
    <ActionButton href="/menu/dashboard/billing" variant="outline" data-test-id="dashboard-upgrade-cta">
      {tBilling('upgradeCta')}
    </ActionButton>
  )

  return (
    <PageShell
      data-test-id="dashboard-home"
      title={t('title')}
      eyebrow={t('eyebrow')}
      description={t('subtitle')}
      actions={actions}
    >
      {/* Headline metrics. */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-test-id="dashboard-metrics">
        <StatCard
          data-test-id="dashboard-views"
          label={t('analytics.scansEyebrow.30d')}
          value={numberFmt.format(monthlyViews)}
          caption={
            unlimitedViews
              ? t('viewsUnlimitedTag')
              : t('viewsRemaining', { count: numberFmt.format(viewsRemaining) })
          }
        />
        <StatCard
          data-test-id="dashboard-restaurants-stat"
          label={t('restaurantsHeading')}
          value={numberFmt.format(restaurants.length)}
        />
        <StatCard
          data-test-id="dashboard-menus"
          label={t('analytics.menusLabel')}
          value={numberFmt.format(totalMenus)}
        />
        <StatCard
          data-test-id="dashboard-dishes"
          label={t('analytics.dishesLabel')}
          value={numberFmt.format(totalDishes)}
        />
      </section>

      {/* Analytics: a link for Kasa, an upgrade nudge for On Us. */}
      {hasAnalytics ? (
        <Link
          href="/menu/dashboard/analytics"
          data-test-id="dashboard-analytics-link"
          className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-card p-5 no-underline transition-colors hover:border-primary/50"
        >
          <span className="min-w-0">
            <span className="block text-[15px] font-bold text-foreground">{t('analytics.topDishesLabel')}</span>
            <span className="block truncate text-[13px] text-muted-foreground">
              {t('analytics.chartEyebrow.30d')}
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-[18px] text-primary">→</span>
        </Link>
      ) : (
        <Link
          href="/menu/dashboard/billing"
          data-test-id="dashboard-analytics-upsell"
          className="flex flex-col gap-1 rounded-[18px] border border-dashed border-border bg-card p-5 no-underline transition-colors hover:border-primary"
        >
          <span className="text-[15px] font-bold text-foreground">{t('analytics.topDishesLabel')}</span>
          <span className="text-[13.5px] text-muted-foreground">{tBilling('upgradeCta')}</span>
        </Link>
      )}

      {/* Restaurants directory. */}
      <section className="space-y-3" data-test-id="dashboard-restaurants">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {t('restaurantsHeading')}
        </h2>
        {restaurants.length === 0 ? (
          <Card>
            <CardTitle>{t('noRestaurants')}</CardTitle>
            <CardDesc>{t('noRestaurantsHint')}</CardDesc>
          </Card>
        ) : (
          <ul data-test-id="restaurant-list" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((r, i) => (
              <li key={r.id}>
                <RecordCard
                  data-test-id="restaurant-card"
                  titleHref={`/dashboard/r/${r.slug}`}
                  title={r.name}
                  subtitle={<span className="font-mono">/r/{r.slug}</span>}
                  trailing={
                    showIndex ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {formatIndex(i + 1)}
                      </span>
                    ) : undefined
                  }
                  meta={`${t('menuCount', { count: r.menuCount })} · ${t('dishCount', { count: r.dishCount })} · ${t('editedAt', { when: formatEditedAt(new Date(r.updatedAt), locale) })}`}
                  footer={
                    <>
                      <RecordAction href={`/dashboard/r/${r.slug}`}>{t('actionMenus')}</RecordAction>
                      <RecordAction href={`/dashboard/r/${r.slug}/theme`}>{t('actionTheme')}</RecordAction>
                      <RecordAction href={`/dashboard/r/${r.slug}/qr`}>{t('actionQr')}</RecordAction>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  )
}
