'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { authClient } from '@/features/auth/client'

/**
 * Sign-in route.
 *
 * Per Better Auth's recommended Next.js pattern, `proxy.ts` redirects
 * unauthenticated visitors of protected routes here (with `?next=<path>`
 * carrying the original destination). This page immediately fires the
 * generic-oauth client → Genkan → callback → menu session cookie →
 * redirect to `next`.
 *
 * We deliberately do NOT redirect to `genkan.iedora.com/login` from
 * `proxy.ts` directly. Signing in at genkan only sets a genkan-domain
 * cookie; the bounce back to menu arrives without a menu session cookie
 * and the proxy loops right back. The full OAuth handshake is what
 * gets the local cookie set — that handshake has to be initiated from
 * menu's own host (here).
 */
export default function SignInRoute() {
  // useSearchParams() is a client-only hook; Next requires it to be
  // wrapped in <Suspense> during the static-page-data collection pass.
  // The inner component reads it; the page exports the Suspense shell.
  return (
    <Suspense fallback={<SigningInIndicator />}>
      <SignInDispatcher />
    </Suspense>
  )
}

/**
 * Sanitise an attacker-controllable `?next=` param down to a same-origin
 * path so the post-auth redirect can't escape menu's host.
 */
function safeNextPath(raw: string | null): string {
  if (!raw) return '/dashboard'
  // Must be a relative path. Reject absolute URLs, protocol-relative
  // URLs (`//evil.com`), and the slash-backslash bypass trick.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return '/dashboard'
  }
  return raw
}

function SignInDispatcher() {
  const params = useSearchParams()
  const next = safeNextPath(params.get('next'))

  useEffect(() => {
    // `signIn.oauth2()` POSTs to /api/auth/sign-in/oauth2; the server
    // responds with `{ url, redirect: true }` (the genkan authorize URL).
    // Better Auth's client does NOT auto-follow that response on its own —
    // we have to do `window.location.href = url` manually. Otherwise the
    // browser stays on /sign-in indefinitely with the fetch wasted.
    // See https://github.com/better-auth/better-auth/issues/1160.
    void authClient.signIn
      .oauth2({ providerId: 'genkan', callbackURL: next })
      .then((res) => {
        const url = res?.data?.url
        if (typeof url === 'string' && url) {
          window.location.href = url
        }
      })
  }, [next])

  return <SigningInIndicator />
}

function SigningInIndicator() {
  return (
    <main
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'var(--serif, ui-serif, Georgia, serif)',
        color: 'var(--ink, #111)',
      }}
    >
      <p
        style={{
          fontStyle: 'italic',
          letterSpacing: '0.02em',
          fontSize: '1.125rem',
          opacity: 0.7,
        }}
      >
        Signing you in…
      </p>
    </main>
  )
}
