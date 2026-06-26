'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  forcePasswordChangeAction,
  setUserPasswordAction,
} from '@iedora/product-menu/features/restaurant-identity/actions'
import { Button } from '@iedora/ui/components/ui/button'

const PILL = '!rounded-full normal-case tracking-normal'

/**
 * Staff password actions on a user record: force a change at next login, or set
 * a temporary password (the user must change it at next login). Both revoke the
 * user's sessions server-side so the change is enforced via re-login.
 */
export function UserAccountActions({ userId }: { userId: string }) {
  const t = useTranslations('Admin.users.actions')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [showSet, setShowSet] = useState(false)
  const [pw, setPw] = useState('')

  function force() {
    setMsg(null)
    start(async () => {
      const r = await forcePasswordChangeAction(userId)
      setMsg(r.ok ? t('forced') : t('failed'))
    })
  }

  function setPassword() {
    setMsg(null)
    if (pw.length < 12) {
      setMsg(t('tooShort'))
      return
    }
    start(async () => {
      const r = await setUserPasswordAction(userId, pw)
      if (r.ok) {
        setPw('')
        setShowSet(false)
        setMsg(t('passwordSet'))
      } else {
        setMsg(t('failed'))
      }
    })
  }

  return (
    <div className="space-y-3" data-test-id="user-account-actions">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={PILL}
          disabled={pending}
          onClick={force}
          data-test-id="user-force-change"
        >
          {t('force')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={PILL}
          disabled={pending}
          onClick={() => setShowSet((s) => !s)}
          data-test-id="user-set-password-toggle"
        >
          {t('setPassword')}
        </Button>
      </div>
      {showSet ? (
        <div className="space-y-2">
          <input
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={t('tempPlaceholder')}
            spellCheck={false}
            autoComplete="off"
            className="w-full min-w-0 rounded-[10px] border border-border bg-card px-3 py-2 font-mono text-[14px] text-foreground outline-none focus:border-primary"
            data-test-id="user-set-password-input"
          />
          <Button
            type="button"
            variant="default"
            size="sm"
            className={PILL}
            disabled={pending}
            onClick={setPassword}
            data-test-id="user-set-password-submit"
          >
            {t('setPasswordSubmit')}
          </Button>
        </div>
      ) : null}
      <p className="text-[12px] leading-[1.5] text-muted-foreground">{t('hint')}</p>
      {msg ? (
        <p className="text-[13px] font-medium text-foreground" role="status" data-test-id="user-action-msg">
          {msg}
        </p>
      ) : null}
    </div>
  )
}
