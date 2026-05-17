import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Separator } from '@iedora/design-system'
import { auth } from '@/features/auth/adapters/better-auth-instance'
import { resolveSafeReturnTo } from '../../(auth)/_lib/safe-return-to'
import { confirmPasswordAction } from './actions'
import { ReauthForm } from './reauth-form'

export const metadata = { title: 'Confirm password' }

type SearchParams = Promise<{ return_to?: string }>

/**
 * Step-up page. Reached when `requireFreshSession()` decides the current
 * session is older than the freshness window. Caller redirects here with
 * `?return_to=<original-url>`; on successful password confirmation, this
 * page bounces the user back there with the session re-stamped.
 */
export default async function ReauthPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { return_to: rawReturnTo } = await searchParams
  const returnTo = resolveSafeReturnTo(rawReturnTo)

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    // No session at all — fall through to the regular login funnel.
    redirect(`/login?return_to=${encodeURIComponent(returnTo)}`)
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--s-7)', maxWidth: 480 }}>
      <header style={{ display: 'grid', gap: 'var(--s-2)' }}>
        <span className="eyebrow">/ REAUTH</span>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--serif)',
            fontWeight: 300,
            fontSize: 'clamp(28px, 7vw, 44px)',
            lineHeight: 'var(--lh-tight)',
            letterSpacing: '-0.02em',
          }}
        >
          Confirm it{`'`}s you<span style={{ color: 'var(--cinnabar)' }}>.</span>
        </h1>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 'var(--t-lg)',
            color: 'var(--ink-70)',
          }}
        >
          You{`'`}re about to do something destructive. Re-enter the password
          for <strong>{session.user.email}</strong> to continue.
        </p>
      </header>

      <Separator />

      <ReauthForm
        action={confirmPasswordAction}
        returnTo={returnTo}
        email={session.user.email}
      />

      <p
        style={{
          margin: 0,
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-2xs)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-55)',
        }}
      >
        <Link href={returnTo} style={{ color: 'inherit' }}>
          Cancel
        </Link>
      </p>
    </div>
  )
}
