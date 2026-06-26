'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { changePasswordAction } from '@iedora/product-menu/features/account/actions'
import { PASSWORD_MIN } from '@iedora/product-menu/features/auth/schemas'
import { Button } from '@iedora/ui/components/ui/button'
import { PasswordField } from '@iedora/ui/components/field'

/** Owner self-service change-password (current + new). Verifies the current
 *  password server-side; a successful change signs out the owner's other
 *  devices. */
export function ChangePasswordForm() {
  const t = useTranslations('Misc.security')
  const tf = useTranslations('Auth.fields')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (next.length < PASSWORD_MIN) {
      setMsg({ tone: 'err', text: tf('passwordMin', { min: PASSWORD_MIN }) })
      return
    }
    if (next !== confirm) {
      setMsg({ tone: 'err', text: tf('passwordMismatch') })
      return
    }
    start(async () => {
      const r = await changePasswordAction({ currentPassword: current, newPassword: next })
      if (r.ok) {
        setCurrent('')
        setNext('')
        setConfirm('')
        setMsg({ tone: 'ok', text: t('done') })
      } else {
        setMsg({ tone: 'err', text: r.error === 'wrongCurrent' ? t('wrongCurrent') : t('failed') })
      }
    })
  }

  const showHide = { showLabel: tf('showPassword'), hideLabel: tf('hidePassword') } as const

  return (
    <form onSubmit={submit} className="space-y-3" data-test-id="change-password-form">
      <PasswordField
        label={t('current')}
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        maxLength={256}
        {...showHide}
        data-test-id="cp-current"
      />
      <PasswordField
        label={t('new')}
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        maxLength={256}
        hint={t('hint', { min: PASSWORD_MIN })}
        {...showHide}
        data-test-id="cp-new"
      />
      <PasswordField
        label={t('confirm')}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        maxLength={256}
        {...showHide}
        data-test-id="cp-confirm"
      />
      {msg ? (
        <p
          className={`text-[13px] ${msg.tone === 'ok' ? 'text-green-700' : 'text-destructive'}`}
          role="status"
          data-test-id="cp-msg"
        >
          {msg.text}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="default"
        className="!rounded-full normal-case tracking-normal"
        disabled={pending}
        data-test-id="cp-submit"
      >
        {pending ? t('saving') : t('save')}
      </Button>
    </form>
  )
}
