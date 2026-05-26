import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/features/auth/adapters/session'
import { publicUrl } from '@/shared/url'

const protectedPrefixes = ['/dashboard', '/onboarding']

/**
 * Hosts served by the iedora.com brand page (instead of menu's app).
 * Caddy forwards both `iedora.com` and `www.iedora.com` to the same
 * upstream; the proxy decides what to render based on Host.
 */
const houseHosts = new Set(['iedora.com', 'www.iedora.com'])

/**
 * Two jobs in order of precedence:
 *
 *   1. **Host-based rewrite.** When the request's Host is one of
 *      `houseHosts`, rewrite the pathname to `/house/<original>`. The
 *      `/house` segment is the internal namespace inside this app for
 *      everything iedora.com serves. Direct visits to
 *      `menu.iedora.com/house*` 404 (see the guard below).
 *
 *   2. **Optimistic auth gate** for menu's protected prefixes —
 *      AGENTS.md hard rule #5. Real auth runs in the DAL; this only
 *      avoids a wasted RSC render when the caller obviously isn't
 *      signed in. Redirect target is `/api/auth/login?next=…` and the
 *      URL goes through `publicUrl()` (not `req.nextUrl.clone()`)
 *      because Caddy fronts Next in prod — `req.nextUrl` carries the
 *      internal bind `http://0.0.0.0:3000` which the browser refuses
 *      to follow.
 */
export default function proxy(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0]
  const path = req.nextUrl.pathname

  // 1. House host → rewrite under /house.
  if (houseHosts.has(host)) {
    // /house is the internal target; anything else gets prefixed.
    const target = path === '/' ? '/house' : `/house${path}`
    const url = req.nextUrl.clone()
    url.pathname = target
    return NextResponse.rewrite(url)
  }

  // Direct visits to /house* from menu.iedora.com don't make sense —
  // the namespace is reserved for iedora.com. 404 to keep the URL
  // surface honest.
  if (path === '/house' || path.startsWith('/house/')) {
    return new NextResponse('Not Found', { status: 404 })
  }

  // 2. Menu's optimistic auth check.
  const isProtected = protectedPrefixes.some((p) => path.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const hasSession = req.cookies.has(SESSION_COOKIE)
  if (!hasSession) {
    return NextResponse.redirect(publicUrl('/api/auth/login', { next: path }))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
