import { oauthAuthorizeUrl as build } from "@iedora/auth-sdk/next/client"

const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? "http://localhost:4000"
const AUTH_TENANT = process.env.NEXT_PUBLIC_AUTH_TENANT ?? "iedora"

// Which OAuth providers to offer, driven by env so the UI matches what's actually
// seeded on the iedora realm (empty = no buttons). e.g. "google,github".
export const OAUTH_PROVIDERS: string[] = (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean)

/** Authorize URL for a provider, returning to the central OAuth callback with the
 *  post-sign-in `next` preserved (the provider round-trip drops query state, so we
 *  carry it on the callback URL). */
export function oauthAuthorizeUrl(providerId: string, next: string): string {
  const redirect = `${window.location.origin}/oauth-callback?next=${encodeURIComponent(next)}`
  return build({ baseUrl: AUTH_BASE_URL, tenant: AUTH_TENANT }, providerId, redirect)
}
