import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { requireRestaurantBySlug } from '@/lib/dal'
import { getRestaurantMenusWithCounts } from '@/lib/dashboard/queries'
import { Button } from '@/components/ui/button'
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
import { CreateMenuDialog } from './create-menu-dialog'
import { DeleteMenuButton } from './delete-menu-button'
import { PublishToggle } from './publish-toggle'
import { SeedSampleButton } from './seed-sample-button'

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { restaurant: r } = await requireRestaurantBySlug(slug)
  const t = await getTranslations('Restaurant')
  const tDash = await getTranslations('Dashboard')
  const locale = await getLocale()

  const menus = await getRestaurantMenusWithCounts(r.id)

  const rows: EditorialRowData[] = menus.map((m, i) => ({
    id: m.id,
    href: `/dashboard/r/${slug}/m/${m.id}`,
    title: m.name,
    index: formatIndex(i + 1),
    subtitle: (
      <>
        <StatusPill
          status={{
            kind: m.active ? 'active' : 'disabled',
            label: m.active ? t('statusActive') : t('statusDisabled'),
          }}
        />
        <span aria-hidden="true">·</span>
        <span>{tDash('editedAt', { when: formatEditedAt(m.updatedAt, locale) })}</span>
      </>
    ),
    metadata: `${t('categoryCount', { count: m.categoryCount })} · ${t('dishCount', { count: m.dishCount })}`,
    extraActions: (
      <DeleteMenuButton slug={slug} menuId={m.id} menuName={m.name} />
    ),
  }))

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
            ← {t('back')}
          </Link>
          <span className="mt-1 block font-serif text-[13px] italic text-muted-foreground">
            {t('eyebrow')}
          </span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{r.name}</h1>
          <p className="text-sm text-muted-foreground">
            /r/{r.slug} · {r.published ? tDash('published') : tDash('draft')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PublishToggle slug={slug} published={r.published} />
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/dashboard/r/${slug}/theme`} />}
          >
            {t('settings')}
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/dashboard/r/${slug}/qr`} />}
          >
            {t('qrCode')}
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/r/${r.slug}`} target="_blank" rel="noreferrer" />}
          >
            {t('viewPublicMenu')}
          </Button>
        </div>
      </div>

      <EditorialList
        testId="menu-list"
        header={
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">{t('menus')}</h2>
            <div className="flex items-center gap-2">
              <SeedSampleButton slug={slug} />
              <CreateMenuDialog slug={slug} />
            </div>
          </div>
        }
        rows={rows}
        emptyState={
          <Card>
            <CardHeader>
              <CardTitle>{t('noMenus')}</CardTitle>
              <CardDescription>{t('noMenusHint')}</CardDescription>
            </CardHeader>
          </Card>
        }
      />

    </div>
  )
}
