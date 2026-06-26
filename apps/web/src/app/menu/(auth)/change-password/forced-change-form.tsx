'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { changePasswordAction } from '@iedora/product-menu/features/account/actions'
import { PASSWORD_MIN } from '@iedora/product-menu/features/auth/schemas'
import { Button } from '@iedora/ui/components/ui/button'
import { PasswordField } from '@iedora/ui/components/field'

/**
 * Forced password-change screen. The user has just signed in with their old
 * password (so we don't re-ask for it) and must set a new one before reaching
 * the dashboard. On success we do a full-page navigation so the dashboard
 * re-renders past the now-cleared guard.
 */
export function ForcedChangeForm() {
  const t = useTranslations('Auth.changePassword')
  const tf = useTranslations('Auth.fields')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < PASSWORD_MIN) {
      setError(tf('passwordMin', { min: PASSWORD_MIN }))
      return
    }
    if (password !== confirm) {
      setError(tf('passwordMismatch'))
      return
    }
    setPending(true)
    const result = await changePasswordAction({ newPassword: password })
    if (result.ok) {
      setDone(true)
      window.location.assign('/menu/dashboard')
      return
    }
    setPending(false)
    setError(t('failed'))
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" data-test-id="forced-change-form">
      <PasswordField
        label={t('newLabel')}
        autoComplete="new-password"
        autoFocus
        maxLength={256}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t('newPlaceholder')}
        hint={t('hint', { min: PASSWORD_MIN })}
        showLabel={tf('showPassword')}
        hideLabel={tf('hidePassword')}
        data-test-id="forced-change-password"
      />
      <PasswordField
        label={t('confirmLabel')}
        autoComplete="new-password"
        maxLength={256}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        showLabel={tf('showPassword')}
        hideLabel={tf('hidePassword')}
        data-test-id="forced-change-confirm"
      />
      {error && (
        <p className="text-[13px] text-[#D92D20]" role="alert" data-test-id="forced-change-error">
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="default"
        size="lg"
        className="!w-full !justify-center !rounded-full normal-case tracking-normal"
        disabled={pending || done}
        data-test-id="forced-change-submit"
      >
        {pending || done ? t('submitting') : t('submit')}
      </Button>
    </form>
  )
}
