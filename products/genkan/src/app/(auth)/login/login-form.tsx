'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Button,
  Field,
  FieldHint,
  FieldInput,
  FieldLabel,
} from '@iedora/design-system'
import { authClient } from '@/features/auth/client'

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Preserve the full query string so the OAuth round-trip survives a switch
  // to the sign-up form (we need every signed param, not just return_to).
  const searchParams = useSearchParams()
  const queryString = useMemo(() => {
    const s = searchParams?.toString() ?? ''
    return s ? `?${s}` : ''
  }, [searchParams])

  // Detect whether we're mid-OAuth-authorize. Better Auth's oauth-provider
  // signs the authorize URL with `sig` (+ `exp`/`ba_iat`); presence of both
  // `client_id` and `sig` is the cheapest reliable signal.
  const isOAuthResume = Boolean(
    searchParams?.has('client_id') && searchParams?.has('sig'),
  )

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email'))
    const password = String(formData.get('password'))

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message ?? 'Invalid credentials.')
      setPending(false)
      return
    }

    // Mid-OAuth-authorize? Resume the flow on Better Auth's continue
    // endpoint with the original signed query string. It will validate,
    // see the now-signed-in session, issue a code, and redirect back to
    // the client app's callback.
    if (isOAuthResume) {
      window.location.assign(
        `/api/auth/oauth2/continue${window.location.search}`,
      )
      return
    }

    // Full page navigation so cross-subdomain cookies attach naturally on
    // the destination's first request.
    window.location.assign(returnTo)
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div style={{ display: 'grid', gap: 28 }}>
        <Field error={Boolean(error)}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <FieldInput
            id="email"
            type="email"
            name="email"
            placeholder="you@—"
            autoComplete="email"
            required
          />
          <FieldHint>The address you signed up with.</FieldHint>
        </Field>
        <Field error={Boolean(error)}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <FieldInput
            id="password"
            type="password"
            name="password"
            placeholder="—"
            autoComplete="current-password"
            required
          />
          {error ? (
            <FieldHint role="alert">{error}</FieldHint>
          ) : (
            <FieldHint>Eight or more characters.</FieldHint>
          )}
        </Field>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 28,
        }}
      >
        <Link
          href={`/signup${queryString}`}
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-55)',
            textDecoration: 'none',
          }}
        >
          Need a key? Sign up
        </Link>
        <Button type="submit" variant="accent" arrow disabled={pending}>
          {pending ? 'Entering' : 'Enter'}
        </Button>
      </div>
    </form>
  )
}
