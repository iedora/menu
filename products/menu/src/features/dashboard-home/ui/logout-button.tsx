'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@iedora/design-system'
import { SIGN_OUT_PATH } from '@/shared/brand'

export function LogoutButton() {
  const t = useTranslations('AppHeader')
  return (
    <Button
      variant="ghost"
      data-test-id="dashboard-logout"
      onClick={() => {
        // /api/auth/logout clears menu's session cookie + bounces the
        // browser to Zitadel's end_session, which drops the Zitadel-side
        // session and lands the user back on `/`. Plain href navigation
        // (no fetch) — keeps the route handler cookie-set headers in the
        // top-level response.
        window.location.assign(SIGN_OUT_PATH)
      }}
    >
      {t('logout')}
    </Button>
  )
}
