'use client'

import { useState, useTransition } from 'react'
import {
  Button,
  Field,
  FieldHint,
  FieldInput,
  FieldLabel,
} from '@iedora/design-system'

type ReauthAction = (
  formData: FormData,
) => Promise<{ ok: true } | { ok: false; error: string }>

/**
 * Password-only step-up form. Wraps the server action and bounces to
 * `returnTo` on success. The action also calls `redirect()` server-side
 * — the client-side navigation here is a fallback for the (unlikely)
 * case where the action returns success without redirecting.
 */
export function ReauthForm({
  action,
  returnTo,
  email,
}: {
  action: ReauthAction
  returnTo: string
  email: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    formData.set('return_to', returnTo)
    startTransition(async () => {
      const result = await action(formData)
      if (result && 'ok' in result && result.ok === false) {
        setError(result.error)
        return
      }
      // The server action redirects on success; this is the fallback.
      window.location.assign(returnTo)
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div style={{ display: 'grid', gap: 'var(--s-5)' }}>
        {/* Hidden email field so password managers associate the entry
            with the right account when re-confirming. */}
        <input
          type="email"
          name="email"
          value={email}
          autoComplete="username"
          readOnly
          hidden
        />
        <Field error={Boolean(error)}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <FieldInput
            id="password"
            type="password"
            name="password"
            placeholder="—"
            autoComplete="current-password"
            autoFocus
            required
          />
          {error ? (
            <FieldHint role="alert">{error}</FieldHint>
          ) : (
            <FieldHint>
              Confirms the action and re-stamps this session as fresh for the
              next 5 minutes.
            </FieldHint>
          )}
        </Field>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--s-3)',
            alignItems: 'center',
          }}
        >
          <Button type="submit" variant="accent" arrow disabled={pending}>
            {pending ? 'Confirming' : 'Confirm'}
          </Button>
        </div>
      </div>
    </form>
  )
}
