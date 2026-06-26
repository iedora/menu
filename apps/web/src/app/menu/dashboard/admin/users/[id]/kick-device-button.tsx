'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { revokeUserSessionAction } from '@iedora/product-menu/features/restaurant-identity/actions'

/** Kick (revoke) one of a user's devices. Optimistic: the row flips to "signed
 *  out" instantly while the revoke runs in the background, and rolls back to the
 *  button if the server action reports failure. */
export function KickDeviceButton({ userId, family }: { userId: string; family: string }) {
  const t = useTranslations('Admin.sessions')
  const [, start] = useTransition()
  const [kicked, setKicked] = useState(false)

  if (kicked) {
    return <span className="shrink-0 text-[12px] text-muted-foreground">{t('kicked')}</span>
  }

  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          setKicked(true) // optimistic — instant feedback
          const r = await revokeUserSessionAction(userId, family)
          if (!r.ok) setKicked(false) // rollback on failure
        })
      }
      className="shrink-0 rounded-full border border-border px-3 py-1 text-[12px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
      data-test-id="kick-device"
    >
      {t('kick')}
    </button>
  )
}
