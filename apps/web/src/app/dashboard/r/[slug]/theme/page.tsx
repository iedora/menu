import { getTranslations } from 'next-intl/server'
import { requireRestaurantBySlug } from '@iedora/product-menu/features/auth'
import { resolveTheme } from '@iedora/product-menu/features/menu-publishing/rsc/theme'
import { loadMenuTree, localizeTree } from '@iedora/product-menu/features/menu-publishing'
import type { PublicMenu, PublicMenuData } from '@iedora/product-menu/features/menu-publishing/rsc/types'
import {
  getThemeEditorData,
  type ThemeEditorRestaurantRow,
} from '@iedora/product-menu/features/restaurant-identity'
import { ThemeEditor } from '@iedora/product-menu/features/restaurant-identity/ui/theme-editor'
import { DashboardPage } from '@iedora/product-menu/shared/ui/dashboard-page'
import { notFound } from 'next/navigation'
import type { RestaurantTheme } from '@iedora/product-menu/shared/db/schema'
import type { LanguageCode, LocalizedText } from '@iedora/product-menu/features/i18n'

type EditorData = PublicMenuData & {
  rawTheme: RestaurantTheme | null
  defaultLanguage: LanguageCode
  supportedLanguages: LanguageCode[]
  restaurantDescriptionI18n: LocalizedText
}

async function loadEditorData(restaurantId: string): Promise<EditorData> {
  const row: ThemeEditorRestaurantRow | null = await getThemeEditorData(restaurantId)
  if (!row) notFound()

  // Editor preview shows the default-language strings — the renderer doesn't
  // know about i18n maps. Localize-to-default reuses the same helper as the
  // public page so any future field change lives in one place.
  const tree = await loadMenuTree({ restaurantId: row.id, activeOnly: true })
  const menus: PublicMenu[] = localizeTree(tree, row.defaultLanguage, row.defaultLanguage)

  return {
    restaurant: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      logoUrl: row.logoUrl,
      bannerUrl: row.bannerUrl,
    },
    menus,
    rawTheme: row.theme,
    defaultLanguage: row.defaultLanguage,
    supportedLanguages: row.supportedLanguages,
    restaurantDescriptionI18n: row.descriptionI18n,
  }
}

export default async function ThemePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { restaurant: r } = await requireRestaurantBySlug(slug)
  const data = await loadEditorData(r.id)
  const initialTheme = resolveTheme(data.rawTheme)
  const t = await getTranslations('Restaurant')

  return (
    <DashboardPage
      title={t('settings')}
      data-test-id="restaurant-theme"
      crumbs={[
        { label: r.name, href: `/dashboard/r/${slug}`, testId: 'restaurant' },
      ]}
    >
      <ThemeEditor
        slug={slug}
        restaurant={data.restaurant}
        restaurantDescriptionI18n={data.restaurantDescriptionI18n}
        menus={data.menus}
        initialTheme={initialTheme}
        initialLanguageSettings={{
          defaultLanguage: data.defaultLanguage,
          supportedLanguages: data.supportedLanguages,
        }}
      />
    </DashboardPage>
  )
}
