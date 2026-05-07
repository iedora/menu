import Link from 'next/link'
import { eq, sql } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import { requireRestaurantBySlug } from '@/lib/dal'
import { db } from '@/lib/db'
import { category, menu } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

  // LEFT JOIN + GROUP BY rather than a correlated subquery: drizzle's `sql`
  // template does NOT qualify column references inside a subquery, so
  // `where ${category.menuId} = ${menu.id}` was rendering as
  // `where "menu_id" = "id"` — both resolved against the inner `category`
  // row, comparing `category.menu_id = category.id`, which never matches
  // and silently returned 0 for every menu.
  // The `::int` cast turns Postgres's bigint count into a JS number; without
  // it postgres-js returns a string and ICU plural's `#` substitution misbehaves.
  const menus = await db
    .select({
      id: menu.id,
      name: menu.name,
      active: menu.active,
      categoryCount: sql<number>`count(${category.id})::int`,
    })
    .from(menu)
    .leftJoin(category, eq(category.menuId, menu.id))
    .where(eq(menu.restaurantId, r.id))
    .groupBy(menu.id, menu.position)
    .orderBy(menu.position)

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

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">{t('menus')}</h2>
          <div className="flex items-center gap-2">
            <SeedSampleButton slug={slug} />
            <CreateMenuDialog slug={slug} />
          </div>
        </div>

        {menus.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('noMenus')}</CardTitle>
              <CardDescription>{t('noMenusHint')}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {menus.map((m) => (
              <div key={m.id} className="group relative">
                <Link href={`/dashboard/r/${slug}/m/${m.id}`} className="block">
                  <Card className="h-full transition-colors hover:bg-accent">
                    <CardHeader>
                      <CardTitle>{m.name}</CardTitle>
                      <CardDescription>
                        {t('categoryCount', { count: m.categoryCount })}
                        {!m.active && ` · ${t('menuDisabled')}`}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
                <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <DeleteMenuButton slug={slug} menuId={m.id} menuName={m.name} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
