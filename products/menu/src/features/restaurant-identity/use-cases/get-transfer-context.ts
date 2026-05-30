import 'server-only'
import { eq } from 'drizzle-orm'
import {
  getTenantById,
  getUser,
  listMembers,
  detectTenantPreset,
  type TenantRolePresetKey,
} from '@iedora/auth'
import { db } from '../../../shared/db/client'
import { restaurant } from '../../../shared/db/schema'

/**
 * Pertinent context for the admin transfer page. Bundles three reads —
 * restaurant row, owning tenant, member roster — into a single typed
 * object so the page is a one-liner. Each underlying @iedora/auth call
 * keeps its single-responsibility focus; this use-case is the
 * orchestrator, nothing more.
 *
 * Member roles are derived live from the membership scope set via
 * `detectTenantPreset` — owners light up distinctly in the UI so the
 * admin sees who they're handing the keys to. Memberships that don't
 * match a preset render as `'custom'` (bespoke grants).
 */
export type TransferContextMember = {
  userId: string
  email: string
  name: string
  role: TenantRolePresetKey | 'custom'
  joinedAt: Date
}

export type TransferContext = {
  restaurant: {
    id: string
    name: string
    slug: string
    tenantId: string
    createdAt: Date
  }
  tenant: {
    id: string
    name: string
    createdAt: Date
  }
  members: TransferContextMember[]
}

export async function getRestaurantTransferContext(
  restaurantId: string,
): Promise<TransferContext | null> {
  const restaurantRow = await loadRestaurant(restaurantId)
  if (!restaurantRow) return null

  const tenant = await getTenantById(restaurantRow.tenantId)
  if (!tenant) return null

  const memberRows = await listMembers(tenant.id)
  const members = await Promise.all(
    memberRows.map<Promise<TransferContextMember>>(async (m) => {
      const u = await getUser(m.userId)
      const preset = detectTenantPreset(m.scopes)
      return {
        userId: m.userId,
        email: u?.email ?? '—',
        name: u?.name ?? '—',
        role: preset ?? 'custom',
        joinedAt: m.createdAt,
      }
    }),
  )

  return {
    restaurant: restaurantRow,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      createdAt: tenant.createdAt,
    },
    members,
  }
}

async function loadRestaurant(
  restaurantId: string,
): Promise<TransferContext['restaurant'] | null> {
  const rows = await db
    .select({
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      tenantId: restaurant.tenantId,
      createdAt: restaurant.createdAt,
    })
    .from(restaurant)
    .where(eq(restaurant.id, restaurantId))
    .limit(1)
  return rows[0] ?? null
}
