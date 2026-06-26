import { getTranslations } from 'next-intl/server'
import type { AdminUserSession } from '@iedora/product-menu/shared/api'
import { deviceLabel } from '@iedora/product-menu/shared/device-label'
import { StatusPill, formatDate } from '../../restaurants/_components/primitives'
import { KickDeviceButton } from './kick-device-button'

/**
 * A user's device/session history — the "Sessions" tab. Shows where (IP) and on
 * what device each session signed in, when it started, and whether it's still
 * live. Mobile-first: each session is its own card. Read-only for now (no
 * revoke action this round).
 */
export async function UserSessions({
  sessions,
  userId,
}: {
  sessions: AdminUserSession[]
  userId?: string
}) {
  const t = await getTranslations('Admin')

  if (sessions.length === 0) {
    return <p className="py-3 text-[14px] text-muted-foreground">{t('sessions.empty')}</p>
  }

  return (
    <ul className="grid grid-cols-1 gap-2" data-test-id="admin-user-sessions">
      {sessions.map((s) => {
        const status = s.current
          ? { tone: 'success' as const, label: t('sessions.active') }
          : s.revokedAt
            ? { tone: 'muted' as const, label: t('sessions.revoked') }
            : { tone: 'muted' as const, label: t('sessions.expired') }
        return (
          <li
            key={s.id}
            className="rounded-[14px] border border-border bg-card p-3"
            data-test-id="admin-user-session"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-foreground">{deviceLabel(s.userAgent)}</p>
                <p className="truncate font-mono text-[12.5px] text-muted-foreground">
                  {s.ip ?? t('sessions.ipUnknown')}
                </p>
              </div>
              <StatusPill tone={status.tone} label={status.label} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[12px] text-muted-foreground">
                {t('sessions.startedOn', { date: formatDate(s.issuedAt) })}
              </p>
              {userId && s.current ? <KickDeviceButton userId={userId} family={s.familyId} /> : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
