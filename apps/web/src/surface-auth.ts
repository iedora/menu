import { PRODUCTS, type ProductId, productUrl } from "@iedora/brand"

// Per-surface AUTHORIZATION (which internal paths need a session, and where to
// bounce an anonymous visitor). Authentication itself is ONE shared realm for
// every surface — the config lives in @iedora/auth-sdk/next (authConfig), and the
// proxy runs the single shared refresh. A single account is valid across menu,
// tutor, and house (SSO via the shared .iedora.com cookie); there are no
// per-surface user pools or per-surface auth configs anymore.

export type SurfaceAuth = {
  productId: ProductId
  /** Internal-path prefixes that require a session. */
  protectedPrefixes: string[]
  /** What an anonymous visitor to a protected path gets. "redirect" (default)
   *  bounces to this surface's sign-in; "notFound" returns 404 so the surface
   *  stays invisible (it has no public sign-in page of its own). */
  onUnauthed?: "redirect" | "notFound"
}

export const SURFACE_AUTH: Record<string, SurfaceAuth> = {
  [PRODUCTS.menu]: {
    productId: PRODUCTS.menu,
    protectedPrefixes: ["/menu/dashboard", "/menu/onboarding"],
  },
  [PRODUCTS.tutor]: {
    productId: PRODUCTS.tutor,
    protectedPrefixes: [
      "/tutor/chat",
      "/tutor/lessons",
      "/tutor/settings",
      "/tutor/account",
      "/tutor/admin",
    ],
  },
  [PRODUCTS.vantage]: {
    productId: PRODUCTS.vantage,
    // The whole vantage surface is the platform super-admin console. It has no
    // sign-in page of its own, so an anonymous visit 404s (invisible console)
    // rather than redirecting into a self-gated /sign-in loop. Admins sign in on
    // their normal product; the shared .iedora.com session (SSO) then carries
    // here, where the platform:admin pre-filter + the layout's JWKS-verified
    // requireSuperAdmin admit only super-admins.
    protectedPrefixes: ["/vantage"],
    onUnauthed: "notFound",
  },
}

/** The surface that owns an internal path (`/menu/…` → menu), or undefined. */
export function surfaceAuthFor(internalPath: string): SurfaceAuth | undefined {
  for (const [name, sa] of Object.entries(SURFACE_AUTH)) {
    if (internalPath === `/${name}` || internalPath.startsWith(`/${name}/`)) return sa
  }
  return undefined
}

/** The surface's public sign-in URL with a `next` back to `returnTo`. One realm,
 *  so any surface's sign-in authenticates the shared account (SSO). */
export function surfaceSignInUrl(sa: SurfaceAuth, returnTo: string): string {
  const url = new URL(`${productUrl(sa.productId)}/sign-in`)
  url.searchParams.set("next", returnTo)
  return url.toString()
}
