/**
 * Public URL surface of the `imopush` product.
 *
 * Two layers — one inside the imopush surface, one for crossing into it
 * from elsewhere. They are SEPARATE on purpose; see the comment below.
 *
 *   1. `IMOPUSH_PATHS` — in-product Next route paths (always prefixed
 *      with `/imopush`). Use these in `<Link href>`, `redirect()`,
 *      `revalidatePath()` — any callsite already inside the imopush
 *      surface where a bare path is correct.
 *
 *   2. `imopush*Url(...)` — absolute URLs for cross-product navigation
 *      (mirrors `signInUrl()` in `products/core/src/url.ts`). The host
 *      side carries the product prefix (subdomain in prod, path-based
 *      in dev) via `productUrl(PRODUCTS.imopush)`, so the path part
 *      here does NOT include `/imopush` — concatenating would
 *      double-prefix.
 *
 *      In prod: `https://imopush.iedora.com/dashboard`
 *      In dev:  `http://localhost:3000/imopush/dashboard`
 *
 * The two definitions look like duplicates but encode different
 * facts — one is "where Next routes us internally", the other is
 * "where the user types it". Keep both; if a future deploy ever lets
 * Next mount imopush at `/` the prefix disappears from `IMOPUSH_PATHS`
 * and the absolute builders are unaffected.
 *
 * Pure strings + URL builders — no env validation, no I/O, safe for
 * client AND server components.
 */

import { PRODUCTS, productUrl } from '@iedora/brand'

/**
 * Known integrator ids. Adding one is a one-line append + a new branch
 * in the consumer switches (TypeScript exhaustiveness flags those).
 */
export type IntegratorId = 'idealista'

/**
 * Canonical in-product Next paths. Use these instead of writing
 * `/imopush/...` literals across pages, actions, and layout.
 */
export const IMOPUSH_PATHS = {
  dashboard: '/imopush/dashboard',
  onboarding: '/imopush/onboarding',
  newProperty: '/imopush/dashboard/p/new',
  property: (reference: string) => `/imopush/dashboard/p/${reference}`,
  integrator: (id: IntegratorId) => `/imopush/dashboard/integrators/${id}`,
} as const

// User-visible paths on the imopush origin — NO `/imopush` prefix here.
// See module docstring for why this is decoupled from IMOPUSH_PATHS.
const IMOPUSH_URL = productUrl(PRODUCTS.imopush)
const DASHBOARD_PATH = '/dashboard'
const NEW_PROPERTY_PATH = '/dashboard/p/new'
const propertyPath = (reference: string) => `/dashboard/p/${reference}`
const integratorPath = (id: IntegratorId) => `/dashboard/integrators/${id}`

export const imopushUrl = (): string => IMOPUSH_URL
export const imopushDashboardUrl = (): string =>
  `${IMOPUSH_URL}${DASHBOARD_PATH}`
export const imopushNewPropertyUrl = (): string =>
  `${IMOPUSH_URL}${NEW_PROPERTY_PATH}`
export const imopushPropertyUrl = (reference: string): string =>
  `${IMOPUSH_URL}${propertyPath(reference)}`
export const imopushIntegratorUrl = (id: IntegratorId): string =>
  `${IMOPUSH_URL}${integratorPath(id)}`
