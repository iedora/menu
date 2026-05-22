/**
 * Drizzle adapter for the menu-import slice.
 *
 * Implements `MenuImportPort` — positional inserts for menu, category, and item.
 * Tenant-scoped: restaurantId is stamped on every row (AGENTS.md hard rule #1).
 *
 * This adapter intentionally does NOT use a transaction — the use-case
 * persists the tree row by row. If a later item insert fails, the partial
 * menu is visible to the user and can be manually completed. A full
 * transaction would be better UX but the current `db` pool doesn't surface
 * a transaction handle to adapters not already inside one. Add a tx-aware
 * variant when the need arises.
 */
import 'server-only'
import { max, eq } from 'drizzle-orm'
import { db } from '@/shared/db/client'
import { category, item, menu, restaurant } from '@/shared/db/schema'
import type { MenuImportPort } from '../ports'

function only<T>(rows: T[], op: string): T {
  const row = rows[0]
  if (!row) throw new Error(`drizzle[menu-import]: ${op} returned no rows`)
  return row
}

function makeDrizzleMenuImport(): MenuImportPort {
  return {
    async createMenu(restaurantId, name) {
      const agg = only(
        await db
          .select({ next: max(menu.position) })
          .from(menu)
          .where(eq(menu.restaurantId, restaurantId)),
        'max(menu.position)',
      )

      const row = only(
        await db
          .insert(menu)
          .values({
            restaurantId,
            name,
            position: (agg.next ?? -1) + 1,
          })
          .returning({ id: menu.id }),
        'insert menu',
      )
      return row.id
    },

    async insertCategory(menuId, restaurantId, name, position) {
      const row = only(
        await db
          .insert(category)
          .values({ menuId, restaurantId, name, position })
          .returning({ id: category.id }),
        'insert category',
      )
      return row.id
    },

    async insertItem(categoryId, restaurantId, fields, position) {
      await db.insert(item).values({
        categoryId,
        restaurantId,
        name: fields.name,
        description: fields.description,
        priceCents: fields.priceCents,
        available: fields.available,
        position,
        // Persist variants when present; null otherwise so the column
        // doesn't carry empty arrays for the common single-price case.
        variants:
          fields.variants && fields.variants.length > 0
            ? fields.variants
            : null,
      })
    },

    async setRestaurantDefaultLanguage(restaurantId, language) {
      const rows = await db
        .update(restaurant)
        .set({ defaultLanguage: language })
        .where(eq(restaurant.id, restaurantId))
        .returning({ id: restaurant.id })
      return rows.length > 0
    },
  }
}

export const drizzleMenuImport = makeDrizzleMenuImport()
