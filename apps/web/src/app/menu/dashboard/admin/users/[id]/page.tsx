import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireStaff } from '@iedora/product-menu/features/auth'
import { loadUserDetail } from '@iedora/product-menu/features/restaurant-identity'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@iedora/ui/components/ui/tabs'
import { DashboardPage } from '@iedora/product-menu/shared/ui/dashboard-page'
import { CopyValue } from '../../restaurants/_components/copy-value'
import {
  CardLabel,
  EntityRow,
  PropertyRow,
  SideCard,
  StatusPill,
  formatDate,
  initialsOf,
} from '../../restaurants/_components/admin-detail'
import { UserAuditTab } from './user-audit-tab'
import { UserLoginsTab } from './user-logins-tab'
import { UserSessions } from './user-sessions'
import { UserAccountActions } from './user-account-actions'

/**
 * Admin user record (`/menu/dashboard/admin/users/[id]`), staff-only — the
 * Clerk-style account view. A Record-Details rail (identity, status, role,
 * verification, reach) beside a tabbed main area: Activity = the full audit
 * timeline (every login, failed attempt, restaurant, plan, payment, edit),
 * Sessions = the device/IP history. The profile + sessions come from one read;
 * the timeline loads lazily when the Activity tab opens.
 */
export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireStaff()
  const { id } = await params

  const [t, detail] = await Promise.all([getTranslations('Admin'), loadUserDetail(id)])
  if (!detail) notFound()

  const { user: u, sessions } = detail
  const name = u.name?.trim() || u.email
  const bannedNow =
    u.banned && !(u.banExpiresAt && new Date(u.banExpiresAt).getTime() < Date.now())
  const status = bannedNow
    ? { tone: 'danger' as const, label: t('users.banned') }
    : { tone: 'success' as const, label: t('users.active') }
  const activeSessions = sessions.filter((s) => s.current).length

  return (
    <DashboardPage chrome="none" title={name} data-test-id="admin-user-detail">
      <div className="grid gap-5 lg:grid-cols-[320px_1fr] lg:items-start">
        {/* Record-Details rail. */}
        <div className="order-2 space-y-5 lg:order-1">
          <SideCard title={t('users.profile')} data-test-id="admin-user-profile">
            <EntityRow initials={initialsOf(name)} name={name} sub={u.email} />
          </SideCard>

          <SideCard title={t('detail.details')}>
            <PropertyRow label={t('users.status')}>
              <StatusPill tone={status.tone} label={status.label} />
            </PropertyRow>
            {bannedNow && u.banReason ? (
              <PropertyRow label={t('users.banReason')}>{u.banReason}</PropertyRow>
            ) : null}
            <PropertyRow label={t('users.role')}>
              {u.role ?? t('users.roleNone')}
            </PropertyRow>
            <PropertyRow label={t('users.emailVerified')}>
              {u.emailVerifiedAt ? formatDate(u.emailVerifiedAt) : t('users.notVerified')}
            </PropertyRow>
            <PropertyRow label={t('users.passwordChanged')}>
              {u.mustChangePassword ? (
                <StatusPill tone="warning" label={t('users.mustChange')} />
              ) : (
                formatDate(u.passwordChangedAt)
              )}
            </PropertyRow>
            <PropertyRow label={t('users.tenantsLabel')}>{String(u.tenantCount)}</PropertyRow>
            <PropertyRow label={t('detail.created')}>{formatDate(u.createdAt)}</PropertyRow>
            <PropertyRow label={t('users.userId')}>
              <CopyValue value={u.id} />
            </PropertyRow>
          </SideCard>

          <SideCard title={t('users.actions.title')} data-test-id="admin-user-actions">
            <UserAccountActions userId={u.id} />
          </SideCard>

          {detail.user.memberships.length > 0 ? (
            <SideCard title={t('users.memberships')} data-test-id="admin-user-memberships">
              <div className="space-y-2">
                {detail.user.memberships.map((m) => (
                  <div key={m.tenantId}>
                    <CardLabel>{m.role}</CardLabel>
                    <CopyValue value={m.tenantId} />
                  </div>
                ))}
              </div>
            </SideCard>
          ) : null}
        </div>

        {/* Tabbed main. */}
        <div className="order-1 min-w-0 lg:order-2">
          <Tabs defaultValue="activity" className="gap-5">
            <TabsList className="w-full sm:w-fit">
              <TabsTrigger value="activity" data-test-id="admin-user-tab-activity">
                {t('detail.activity')}
              </TabsTrigger>
              <TabsTrigger value="logins" data-test-id="admin-user-tab-logins">
                {t('users.loginsTab')}
              </TabsTrigger>
              <TabsTrigger value="sessions" data-test-id="admin-user-tab-sessions">
                {t('users.sessionsTab', { count: activeSessions })}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              <SideCard title={t('users.activityTitle')} data-test-id="admin-user-activity">
                <UserAuditTab userId={u.id} />
              </SideCard>
            </TabsContent>

            <TabsContent value="logins">
              <SideCard title={t('users.loginsTitle')} data-test-id="admin-user-logins">
                <UserLoginsTab userId={u.id} />
              </SideCard>
            </TabsContent>

            <TabsContent value="sessions">
              <SideCard title={t('users.sessionsTitle')} data-test-id="admin-user-sessions-card">
                <UserSessions sessions={sessions} userId={u.id} />
              </SideCard>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardPage>
  )
}
