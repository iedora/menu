import 'server-only'
import { redirect } from 'next/navigation'
import { tenantContext, tracer } from '@iedora/observability'
import type { IdentityGateway } from '@/features/identity'
import type { AuthGateway } from '../ports'
import { requireActiveOrganization } from './require-active-organization'

/**
 * Same as `requireRestaurantAccess` but resolved by URL slug. Returns the
 * matched restaurant subset (`id`, `name`, `slug`) so callers don't need a
 * follow-up query just to render the page header.
 *
 * Same tenant-context seeding as `requireRestaurantAccess`: downstream
 * spans pick up tenant attribution automatically via
 * TenantContextSpanProcessor.
 */
export async function requireRestaurantBySlug(
  auth: AuthGateway,
  identity: IdentityGateway,
  slug: string,
) {
  return tracer.startActiveSpan(
    'auth.require-restaurant-by-slug',
    async (span) => {
      span.setAttribute('iedora.restaurant_slug', slug)
      try {
        const { session, organizationId } = await requireActiveOrganization(
          auth,
          identity,
        )
        const row = await auth.findRestaurantBySlugInOrg({
          slug,
          organizationId,
        })
        if (!row) {
          span.setAttribute('iedora.auth.outcome', 'forbidden')
          redirect('/dashboard')
        }
        tenantContext.enterWith({
          restaurantId: row.id,
          organizationId,
        })
        span.setAttribute('iedora.organization_id', organizationId)
        span.setAttribute('iedora.restaurant_id', row.id)
        span.setAttribute('iedora.auth.outcome', 'allowed')
        return { session, organizationId, restaurant: row }
      } finally {
        span.end()
      }
    },
  )
}
