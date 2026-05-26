import 'server-only'
import { getAuth, type Auth } from '@iedora/auth'

/**
 * Menu's auth handle — same `Auth` shape every iedora product binds to.
 * Lazy-resolved on first call so build-time stub envs don't open sockets.
 *
 * Use:
 *   ```ts
 *   import { auth } from '@/shared/auth'
 *   import { headers } from 'next/headers'
 *
 *   const session = await auth.api.getSession({ headers: await headers() })
 *   ```
 *
 * For mutations from React Server Actions, pass `auth.api.<method>` the
 * `headers: await headers()` argument — `nextCookies()` (last plugin in
 * the iedora-auth instance) propagates Set-Cookie correctly through the
 * Next.js server-action boundary.
 */
let _cached: Auth | null = null

function get(): Auth {
  if (!_cached) _cached = getAuth()
  return _cached
}

export const auth: Auth = new Proxy({} as Auth, {
  get: (_t, key) => Reflect.get(get(), key),
})
