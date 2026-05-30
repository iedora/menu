import 'server-only'
import { redirect } from 'next/navigation'
import { isStaffRole } from '@iedora/auth/role-presets'
import { tenantContext, tracer, IEDORA_RESTAURANT_ID, IEDORA_TENANT_ID } from '@iedora/observability'
import type { AuthGateway } from '../ports'
import { requireActiveOrganization } from './require-active-organization'
import { verifySession } from './verify-session'

/**
 * Same as `requireRestaurantAccess` but resolved by URL slug. Returns
 * the matched restaurant subset (`id`, `name`, `slug`) so callers
 * don't need a follow-up query just to render the page header.
 *
 * Two paths:
 *
 *   - Tenant user → strict gate. The active tenant must own the
 *     slug, otherwise 404-via-redirect.
 *   - Staff (iedora-admin / iedora-support) → cross-tenant lookup.
 *     The slug is found in any tenant; the restaurant's own tenant id
 *     is returned + tenant-context'd. Without this branch, admin
 *     clicking "Abrir" on a restaurant in a tenant they don't own
 *     bounces back to /menu/dashboard.
 *
 * Same tenant-context seeding either way — downstream spans pick up
 * the resolved tenant via TenantContextSpanProcessor.
 */
export async function requireRestaurantBySlug(
  auth: AuthGateway,
  slug: string,
) {
  return tracer.startActiveSpan(
    'auth.require-restaurant-by-slug',
    async (span) => {
      span.setAttribute('iedora.restaurant_slug', slug)
      try {
        const session = await verifySession(auth)
        const isStaff = isStaffRole(session.user.role)

        let tenantId: string
        let row:
          | { id: string; name: string; slug: string; tenantId?: string }
          | null

        if (isStaff) {
          row = await auth.findRestaurantBySlugAnyOrg(slug)
          if (!row) {
            span.setAttribute('iedora.auth.outcome', 'forbidden')
            redirect('/menu/dashboard')
          }
          tenantId = row.tenantId!
        } else {
          const ctx = await requireActiveOrganization(auth)
          tenantId = ctx.tenantId
          row = await auth.findRestaurantBySlugInOrg({ slug, tenantId })
          if (!row) {
            span.setAttribute('iedora.auth.outcome', 'forbidden')
            redirect('/menu/dashboard')
          }
        }

        tenantContext.enterWith({
          restaurantId: row.id,
          tenantId,
        })
        span.setAttribute(IEDORA_TENANT_ID, tenantId)
        span.setAttribute(IEDORA_RESTAURANT_ID, row.id)
        span.setAttribute('iedora.auth.outcome', 'allowed')
        return { session, tenantId, restaurant: row }
      } finally {
        span.end()
      }
    },
  )
}
