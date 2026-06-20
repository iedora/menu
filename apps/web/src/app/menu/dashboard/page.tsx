import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import {
  getSession,
  isStaff,
  requireActiveOrganization,
} from '@iedora/product-menu/features/auth'
import { listRestaurantsWithCounts } from '@iedora/product-menu/features/dashboard-home'
import { getOrganizationMonthlyViews } from '@iedora/product-menu/features/metrics'
import { canAddRestaurant, getOrganizationPlan } from '@iedora/product-menu/features/plans'
import { addAnotherRestaurantHref } from '@iedora/product-menu/features/menu-onboarding'
import { Card, CardDesc, CardTitle } from '@iedora/design-system'
import { DashboardPage as PageShell } from '@iedora/product-menu/shared/ui/dashboard-page'
import {
  EditorialList,
  formatEditedAt,
  formatIndex,
  type EditorialRowData,
} from '@iedora/product-menu/shared/ui/editorial-list'

const VIEW_NUDGE_RATIO = 0.8

export default async function DashboardPage() {
  // Kick off i18n + locale immediately — they don't depend on session
  // and overlap with the auth round-trip (which is cached but still I/O).
  const tPromise = getTranslations('Dashboard')
  const tBillingPromise = getTranslations('Billing')
  const localePromise = getLocale()

  // Staff manage everything via Admin → Restaurantes; the per-tenant
  // home view (view-meter, restaurant cards) is meaningless for them.
  // Short-circuit to the cross-tenant admin list before the tenant gate.
  const session = await getSession()
  if (isStaff(session)) {
    redirect('/menu/dashboard/admin/restaurants')
  }
  await requireActiveOrganization()

  const [t, tBilling, locale, restaurants, canAdd, plan, viewCount] =
    await Promise.all([
      tPromise,
      tBillingPromise,
      localePromise,
      listRestaurantsWithCounts(),
      canAddRestaurant(),
      getOrganizationPlan(),
      getOrganizationMonthlyViews(),
    ])

  const viewLimit = plan.monthlyViews
  const isUnlimitedViews = viewLimit === -1
  const viewsNearLimit =
    !isUnlimitedViews && viewCount / viewLimit >= VIEW_NUDGE_RATIO
  const numberFmt = new Intl.NumberFormat(locale)

  const showIndex = restaurants.length > 1
  const rows: EditorialRowData[] = restaurants.map((r, i) => ({
    id: r.id,
    href: `/dashboard/r/${r.slug}`,
    title: r.name,
    index: showIndex ? formatIndex(i + 1) : undefined,
    subtitle: (
      <>
        <span className="text-muted-foreground">/r/{r.slug}</span>
        <span aria-hidden="true">·</span>
        <span>{t('editedAt', { when: formatEditedAt(new Date(r.updatedAt), locale) })}</span>
      </>
    ),
    metadata: `${t('menuCount', { count: r.menuCount })} · ${t('dishCount', { count: r.dishCount })}`,
    actions: [
      { key: 'menus', label: t('actionMenus'), href: `/dashboard/r/${r.slug}` },
      { key: 'theme', label: t('actionTheme'), href: `/dashboard/r/${r.slug}/theme` },
      { key: 'qr', label: t('actionQr'), href: `/dashboard/r/${r.slug}/qr` },
    ],
  }))

  const description = (
    <>
      {t('subtitle')}
      <br />
      <span
        data-test-id="dashboard-views-meter"
        data-near-limit={viewsNearLimit ? 'true' : 'false'}
      >
        {isUnlimitedViews
          ? t('viewsUnlimited', { count: numberFmt.format(viewCount) })
          : t('viewsCount', {
              count: numberFmt.format(viewCount),
              limit: numberFmt.format(viewLimit),
            })}{' '}
        {t('viewsThisMonth')}
        {!isUnlimitedViews && (
          <span
            data-test-id="dashboard-views-progress"
            aria-hidden="true"
            className="relative ml-2 inline-block h-1.5 w-20 overflow-hidden rounded-full bg-muted align-middle sm:w-32"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width]"
              style={{ width: `${Math.min(100, (viewCount / viewLimit) * 100)}%` }}
            />
          </span>
        )}
      </span>
      {viewsNearLimit && (
        <>
          {' '}
          <Link
            href="/menu/dashboard/billing"
            data-test-id="dashboard-views-upgrade-nudge"
            className="font-medium text-[var(--ink)] underline-offset-4 hover:underline"
          >
            {t('viewsNudge')}
          </Link>
        </>
      )}
    </>
  )

  const actions = canAdd ? (
    <Link
      href={addAnotherRestaurantHref()}
      data-test-id="dashboard-new-restaurant"
      className="inline-flex items-center rounded-[12px] bg-primary px-4 py-2 text-[13.5px] font-semibold text-white no-underline transition-colors hover:bg-[var(--cinnabar-deep)]"
    >
      {t('newRestaurant')}
    </Link>
  ) : (
    <Link
      href="/menu/dashboard/billing"
      data-test-id="dashboard-upgrade-cta"
      className="inline-flex items-center rounded-[12px] border border-border px-4 py-2 text-[13.5px] font-semibold text-foreground no-underline transition-colors hover:border-primary hover:text-primary"
    >
      {tBilling('upgradeCta')}
    </Link>
  )

  return (
    <PageShell
      data-test-id="dashboard-home"
      title={t('title')}
      eyebrow={t('eyebrow')}
      description={description}
      actions={actions}
    >
      <EditorialList
        testId="restaurant-list"
        rows={rows}
        emptyState={
          <Card>
            <CardTitle>{t('noRestaurants')}</CardTitle>
            <CardDesc>{t('noRestaurantsHint')}</CardDesc>
          </Card>
        }
      />
    </PageShell>
  )
}
