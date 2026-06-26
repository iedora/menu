import { getTranslations } from 'next-intl/server'
import { requireStaff } from '@iedora/product-menu/features/auth'
import { listUsersDirectory } from '@iedora/product-menu/features/restaurant-identity'
import { DashboardPage } from '@iedora/product-menu/shared/ui/dashboard-page'
import { UsersTable } from './users-table'

/**
 * Cross-tenant users directory (staff only) — the Clerk-style account list.
 * Lists every account on the platform; tap a row to open the record with the
 * full audit timeline, sessions, and IPs. Search filters client-side over the
 * loaded set. Staff-role is enforced by the service; the page gates with
 * `requireStaff` first.
 */
export default async function AdminUsersPage() {
  await requireStaff()
  const [t, users] = await Promise.all([getTranslations('Admin'), listUsersDirectory()])

  return (
    <DashboardPage
      title={t('users.title')}
      description={t('users.subtitle', { count: users.length })}
      data-test-id="admin-users"
    >
      <section aria-label={t('users.listAria')} data-test-id="admin-users-section">
        <UsersTable users={users} />
      </section>
    </DashboardPage>
  )
}
