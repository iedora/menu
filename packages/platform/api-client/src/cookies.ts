/**
 * The two auth cookies the Next server owns, both HttpOnly:
 *
 *  - `iedora_access`  — the access JWT (15 min), mirrored out of the
 *    auth-service JSON response so middleware/RSCs can read it.
 *  - `iedora_refresh` — the opaque refresh token. The service sets it
 *    with `Path=/auth` (its own surface); we terminate the browser
 *    connection, so we re-issue it under `Path=/` with our attributes.
 */

import type { TokenResponse } from '@iedora/contracts'

export const ACCESS_COOKIE = 'iedora_access'
export const REFRESH_COOKIE = 'iedora_refresh'

/** JSON body of the auth endpoints (register/login/refresh) — the shared
 *  @iedora/contracts schema the auth service validates against. Re-exported
 *  for the existing consumers that import it from this module. */
export type { TokenResponse }

/** Cookie write in a shape both `cookies()` and NextResponse accept. */
export type CookieWrite = {
  name: string
  value: string
  options: {
    httpOnly: boolean
    secure: boolean
    sameSite: 'lax'
    path: string
    expires?: Date
    maxAge?: number
  }
}

const baseOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
} as const

/**
 * Builds the cookie writes for a successful auth response: the access token
 * (expiring with the JWT) and the refresh token — both read from the JSON body
 * (auth-sdk TokenBundle style). The BFF owns the cookies under `Path=/`.
 */
export function authCookies(tokens: TokenResponse): CookieWrite[] {
  return [
    {
      name: ACCESS_COOKIE,
      value: tokens.accessToken,
      options: { ...baseOptions, expires: new Date(tokens.expiresAt) },
    },
    {
      name: REFRESH_COOKIE,
      value: tokens.refreshToken,
      options: { ...baseOptions, expires: new Date(tokens.refreshExpiresAt) },
    },
  ]
}

/** Cookie writes that delete both auth cookies (sign-out / dead refresh). */
export function clearedAuthCookies(): CookieWrite[] {
  return [ACCESS_COOKIE, REFRESH_COOKIE].map((name) => ({
    name,
    value: '',
    options: { ...baseOptions, maxAge: 0 },
  }))
}

