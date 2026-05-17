'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Button,
  Field,
  FieldHint,
  FieldInput,
  FieldLabel,
} from '@iedora/design-system'
import { authClient } from '@/features/auth/client'

export function SignupForm({ returnTo }: { returnTo: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('name'))
    const email = String(formData.get('email'))
    const password = String(formData.get('password'))

    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message ?? 'Could not create the account.')
      setPending(false)
      return
    }

    // First-time sign-up always lands at onboarding (org creation lives there).
    // After onboarding, that flow handles the final hand-off to `returnTo`.
    window.location.assign(
      `/onboarding?return_to=${encodeURIComponent(returnTo)}`,
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div style={{ display: 'grid', gap: 28 }}>
        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <FieldInput
            id="name"
            type="text"
            name="name"
            placeholder="—"
            autoComplete="name"
            required
          />
          <FieldHint>How we should address you.</FieldHint>
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <FieldInput
            id="email"
            type="email"
            name="email"
            placeholder="you@—"
            autoComplete="email"
            required
          />
          <FieldHint>Used to sign in and recover the account.</FieldHint>
        </Field>
        <Field error={Boolean(error)}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <FieldInput
            id="password"
            type="password"
            name="password"
            placeholder="—"
            autoComplete="new-password"
            minLength={8}
            required
          />
          {error ? (
            <FieldHint role="alert">{error}</FieldHint>
          ) : (
            <FieldHint>Eight characters at minimum.</FieldHint>
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
          href={`/login?return_to=${encodeURIComponent(returnTo)}`}
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-55)',
            textDecoration: 'none',
          }}
        >
          Already have a key? Sign in
        </Link>
        <Button type="submit" variant="accent" arrow disabled={pending}>
          {pending ? 'Creating' : 'Sign up'}
        </Button>
      </div>
    </form>
  )
}
