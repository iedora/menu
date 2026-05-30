/**
 * Cookie names better-auth writes for the session. Centralised here so
 * surfaces that need to peek at the cookie WITHOUT going through
 * `auth.api.getSession()` (the proxy's optimistic redirect, edge
 * middlewares) all reference the same strings.
 *
 * Two names because better-auth picks the `__Secure-` prefix when the
 * cookie is on HTTPS (prod). Plain prefix in dev. `SESSION_COOKIE_NAMES`
 * lists both — callers iterate.
 *
 * Framework-free. No `server-only`. Safe in proxy.ts / middleware / RSC.
 */
export const SESSION_COOKIE_NAME = 'better-auth.session_token' as const
export const SECURE_SESSION_COOKIE_NAME =
  '__Secure-better-auth.session_token' as const

export const SESSION_COOKIE_NAMES = [
  SECURE_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
] as const
