'use client'

import { useTranslations } from 'next-intl'
import { authClient } from '@/features/auth/client'
import { GENKAN_URL } from '@/shared/brand'
import { Button } from '@iedora/design-system'

export function LogoutButton() {
  const t = useTranslations('AppHeader')
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        // Hits menu's local /api/auth/sign-out, which deletes the row in
        // the shared session table and clears the .iedora.com cookie. After
        // that the user is unauthenticated everywhere in the ecosystem;
        // a full navigation to Genkan presents the sign-in entryway again.
        await authClient.signOut()
        window.location.assign(`${GENKAN_URL}/login`)
      }}
    >
      {t('logout')}
    </Button>
  )
}
