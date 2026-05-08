import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { requireActiveOrganization } from '@/lib/dal'
import { getOrganizationRestaurantsWithCounts } from '@/lib/dashboard/queries'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  EditorialList,
  formatEditedAt,
  formatIndex,
  StatusPill,
  type EditorialRowData,
} from '@/components/editorial-list'

export default async function DashboardPage() {
  const { organizationId } = await requireActiveOrganization()
  const t = await getTranslations('Dashboard')
  const locale = await getLocale()

  const restaurants = await getOrganizationRestaurantsWithCounts(organizationId)

  const rows: EditorialRowData[] = restaurants.map((r, i) => ({
    id: r.id,
    href: `/dashboard/r/${r.slug}`,
    title: r.name,
    index: formatIndex(i + 1),
    subtitle: (
      <>
        <span className="text-muted-foreground">/r/{r.slug}</span>
        <span aria-hidden="true">·</span>
        <StatusPill
          status={{
            kind: r.published ? 'live' : 'draft',
            label: r.published ? t('published') : t('draft'),
          }}
        />
        <span aria-hidden="true">·</span>
        <span>{t('editedAt', { when: formatEditedAt(r.updatedAt, locale) })}</span>
      </>
    ),
    metadata: `${t('menuCount', { count: r.menuCount })} · ${t('dishCount', { count: r.dishCount })}`,
    actions: [
      { key: 'menus', label: t('actionMenus'), href: `/dashboard/r/${r.slug}` },
      { key: 'theme', label: t('actionTheme'), href: `/dashboard/r/${r.slug}/theme` },
      { key: 'qr', label: t('actionQr'), href: `/dashboard/r/${r.slug}/qr` },
    ],
  }))

  const publishedCount = restaurants.filter((r) => r.published).length

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6">
        <div className="max-w-xl">
          <span className="block font-serif text-[13px] italic text-muted-foreground">
            {t('eyebrow')}
          </span>
          <h1 className="mt-1 font-serif text-[32px] italic font-medium leading-tight tracking-tight">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/onboarding"
            className="inline-flex items-center border border-foreground bg-foreground px-3.5 py-2 text-[13px] font-medium text-background no-underline transition-colors hover:bg-background hover:text-foreground"
          >
            {t('newRestaurant')}
          </Link>
        </div>
      </div>

      <EditorialList
        testId="restaurant-list"
        rows={rows}
        emptyState={
          <Card>
            <CardHeader>
              <CardTitle>{t('noRestaurants')}</CardTitle>
              <CardDescription>{t('noRestaurantsHint')}</CardDescription>
            </CardHeader>
          </Card>
        }
        footer={
          <div className="flex items-center justify-between border-t border-border pt-4 text-[12.5px] text-muted-foreground">
            <span className="font-serif italic">
              {t('footerSummary', {
                published: publishedCount,
                total: restaurants.length,
              })}
            </span>
          </div>
        }
      />
    </div>
  )
}
