import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@iedora/product-menu/features/auth'
import { signInUrl } from '@iedora/product-menu/shared/auth-urls'
import { publicUrl } from '@iedora/product-menu/shared/url'
import { ForcedChangeForm } from './forced-change-form'

/**
 * Forced password-change screen (reached from the dashboard guard when an admin
 * has flagged the account). Authenticated — the user signed in moments ago with
 * their old password. Lives in the warm `(auth)` chrome, outside the dashboard
 * layout, so the guard can route here without a loop.
 */
export default async function ChangePasswordPage() {
  const session = await getSession()
  if (!session) redirect(signInUrl(publicUrl('/menu/dashboard').toString()))

  const t = await getTranslations('Auth.changePassword')

  return (
    <div className="flex flex-col gap-6" data-test-id="forced-change">
      <header className="space-y-1.5">
        <h1 className="font-[family-name:var(--display)] text-[26px] font-extrabold tracking-[-0.01em] text-foreground">
          {t('title')}
        </h1>
        <p className="text-[15px] text-muted-foreground">{t('subtitle')}</p>
      </header>
      <ForcedChangeForm />
    </div>
  )
}
