import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { ACCESS_COOKIE, sessionFromToken, whoami } from '@iedora/api-client'

/**
 * Dashboard guard: while the account is flagged for a forced password change,
 * route the user to the change-password screen (which lives OUTSIDE this layout,
 * so no redirect loop).
 *
 * Fast path: the flag rides in the access token's `mcp` claim, so the COMMON
 * case (not flagged) is decided locally with zero network — no DB round-trip on
 * every dashboard navigation. Only a token that actually carries the flag pays
 * for the LIVE `whoami` confirmation, which lets the redirect stop the instant
 * the change completes (the token claim lags until the next refresh). Fail-open
 * — a transient auth blip never locks a user out.
 */
export const enforcePasswordChange = cache(async (): Promise<void> => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value
  if (!token) return
  // Local short-circuit: no claim → nothing to enforce, no network.
  if (!sessionFromToken(token)?.mustChangePassword) return
  let must = false
  try {
    must = (await whoami(token)).mustChangePassword
  } catch {
    return
  }
  if (must) redirect('/menu/change-password')
})
