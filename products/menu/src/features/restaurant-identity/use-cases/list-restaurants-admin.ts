import 'server-only'
import { desc } from 'drizzle-orm'
import { db } from '../../../shared/db/client'
import { restaurant } from '../../../shared/db/schema'

/**
 * Cross-tenant admin projection — newest-first, includes `tenantId`
 * for the admin restaurants page's tenant-name join + transfer links.
 * Distinct from `listRestaurantsCrossTenant` which drops tenantId
 * (used by the QR admin where only the slug matters).
 *
 * Gating is on the caller (`requireScope(staff:menu:restaurants:transfer)`).
 */
export async function listRestaurantsAdmin(limit = 200) {
  return db
    .select({
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      tenantId: restaurant.tenantId,
      createdAt: restaurant.createdAt,
    })
    .from(restaurant)
    .orderBy(desc(restaurant.createdAt))
    .limit(limit)
}
