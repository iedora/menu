'use client'

import * as React from 'react'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  BrowserIcon,
  Button,
  Histogram,
  OsIcon,
  SectionHeader,
  Stat,
  StatsPanel,
} from '@iedora/design-system'
import { revokeAllForUserAction, revokeSessionAction } from '../actions'
import type { AuthMethod, ZitadelUserState } from '../adapters/zitadel-enrichment'
import type { SessionStats } from '../stats'


export type SessionAdminRow = {
  id: string
  userId: string
  email: string
  displayName: string
  username: string | null
  state: ZitadelUserState | null
  emailVerified: boolean | null
  roles: string[]
  permissions: string[]
  permissionsVersion: number
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  userAgent: string | null
  ipHashShort: string | null
  authMethods: AuthMethod[]
  isOwnSession: boolean
}

/**
 * Re-export only — the page does the projection in `to-row.ts`.
 */
export type { ZitadelUserState }

/**
 * Cross-tenant sessions dashboard — displays active sessions grouped by user
 * with interactive collapsible panels to inspect individual devices, client details,
 * and OIDC scopes. Designed to be completely mobile-first (zero horizontal overflow)
 * with zero raw text truncations.
 */
export function SessionsAdmin({
  rows,
  stats,
  snapshotAt,
  bundles = {},
}: {
  rows: SessionAdminRow[]
  stats: SessionStats
  /** ISO timestamp of when the snapshot was taken (server side). */
  snapshotAt: string
  bundles?: Record<string, ReadonlyArray<string>>
}) {
  return (
    <div className="space-y-6" data-test-id="sessions-admin-content">
      <SessionsStatsPanel stats={stats} snapshotAt={snapshotAt} />
      <SessionsList rows={rows} bundles={bundles} />
    </div>
  )
}

// ── Stats panel ─────────────────────────────────────────────────────────────

function SessionsStatsPanel({
  stats,
  snapshotAt,
}: {
  stats: SessionStats
  snapshotAt: string
}) {
  const t = useTranslations('SessionsAdmin.stats')
  const avg = Number.isNaN(stats.avgAgeHours)
    ? '—'
    : stats.avgAgeHours < 1
      ? `${Math.round(stats.avgAgeHours * 60)}m`
      : `${stats.avgAgeHours.toFixed(1)}h`

  return (
    <StatsPanel
      title={t('title')}
      snapshotAt={snapshotAt}
      stats={[
        <Stat key="total" label={t('sessions')} value={String(stats.total)} />,
        <Stat key="users" label={t('users')} value={String(stats.uniqueUsers)} />,
        <Stat
          key="new"
          label={t('new24h')}
          value={String(stats.last24h)}
          hint={stats.last24h > 0 ? t('loginsHint') : t('noneHint')}
        />,
        <Stat
          key="stale"
          label={t('stale24h')}
          value={String(stats.staleCount)}
          tone="warn"
        />,
        <Stat key="age" label={t('avgAge')} value={avg} hint={t('avgAgeHint')} />,
        <Stat
          key="perm"
          label={t('maxPermVersion')}
          value={String(stats.permissionVersionMax)}
          hint={t('maxPermVersionHint')}
        />,
      ]}
      histograms={[
        <Histogram
          key="browsers"
          label={t('browsers')}
          entries={stats.browsers}
          renderIcon={(name) => <BrowserIcon name={name} className="h-3.5 w-3.5" />}
        />,
        <Histogram
          key="os"
          label={t('operatingSystems')}
          entries={stats.operatingSystems}
          renderIcon={(name) => <OsIcon name={name} className="h-3.5 w-3.5" />}
        />,
      ]}
    />
  )
}

// ── Sessions Grouped List ───────────────────────────────────────────────────

type UserGroupSummary = {
  userId: string
  displayName: string
  email: string
  username: string | null
  state: ZitadelUserState | null
  emailVerified: boolean | null
  authMethods: AuthMethod[]
  isOwnSession: boolean
}

function SessionsList({
  rows,
  bundles,
}: {
  rows: SessionAdminRow[]
  bundles: Record<string, ReadonlyArray<string>>
}) {
  const t = useTranslations('SessionsAdmin.list')
  const userIds = Array.from(new Set(rows.map((r) => r.userId)))

  // Group sessions by userId
  const grouped = rows.reduce((acc, row) => {
    let group = acc[row.userId]
    if (!group) {
      group = {
        user: {
          userId: row.userId,
          displayName: row.displayName,
          email: row.email,
          username: row.username,
          state: row.state,
          emailVerified: row.emailVerified,
          authMethods: row.authMethods,
          isOwnSession: false,
        },
        sessions: [],
      }
      acc[row.userId] = group
    }
    group.sessions.push(row)
    if (row.isOwnSession) {
      group.user.isOwnSession = true
    }
    return acc
  }, {} as Record<string, { user: UserGroupSummary; sessions: SessionAdminRow[] }>)

  const userGroups = Object.values(grouped)

  return (
    <section className="space-y-4">
      <SectionHeader
        title={t('activeCount', { total: rows.length, users: userIds.length })}
      />

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--ink-55)]">{t('empty')}</p>
      ) : (
        <div className="space-y-4" data-test-id="sessions-user-list">
          {userGroups.map(({ user, sessions }) => (
            <UserGroupCard
              key={user.userId}
              user={user}
              sessions={sessions}
              bundles={bundles}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function UserGroupCard({
  user,
  sessions,
  bundles,
}: {
  user: UserGroupSummary
  sessions: SessionAdminRow[]
  bundles: Record<string, ReadonlyArray<string>>
}) {
  const t = useTranslations('SessionsAdmin.userCard')
  const [expanded, setExpanded] = useState(true) // Default expanded for premium scannability
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  function onRevokeAll() {
    const ok = confirm(
      t('revokeAllConfirm', { name: user.displayName, email: user.email }),
    )
    if (!ok) return
    setError(null)
    setStatus(null)
    startTransition(async () => {
      const res = await revokeAllForUserAction(user.userId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setStatus(t('revokeAllStatus', { count: 'count' in res && typeof res.count === 'number' ? res.count : 0 }))
    })
  }

  const userRoles = Array.from(new Set(sessions.flatMap((s) => s.roles)))

  return (
    <div
      data-test-id={`user-group-${user.userId}`}
      className="border border-[var(--ink-14)] bg-[var(--paper)] transition-all duration-200 overflow-hidden hover:border-[var(--ink-24)]"
    >
      {/* User Card Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 bg-[var(--paper-2)] border-b border-[var(--ink-14)]">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex flex-col min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-[var(--ink)] font-sans">
                {user.displayName}
              </span>
              {user.isOwnSession && (
                <span className="text-xs text-[var(--cinnabar)] font-medium shrink-0">
                  {t('thisDevice')}
                </span>
              )}
              <StateBadge state={user.state} />
              {user.emailVerified === false && (
                <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--cinnabar)] border border-[var(--cinnabar)] px-1 rounded-sm shrink-0">
                  {t('unverified')}
                </span>
              )}
            </div>
            <span className="text-xs text-[var(--ink-55)] mt-0.5 break-all">{user.email}</span>
            {user.username && user.username !== user.email && (
              <span className="font-mono text-[10px] text-[var(--ink-40)] mt-0.5 break-all">
                {user.username}
              </span>
            )}
            {userRoles.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2" data-test-id="user-roles-list">
                {userRoles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-wider bg-[var(--paper-3)] border border-[var(--ink-14)] text-[var(--ink-70)] select-none hover:border-[var(--ink-24)] transition-all duration-150"
                    title={t('roleTooltip', { role })}
                  >
                    <svg
                      className="h-2.5 w-2.5 text-[var(--ink-40)] shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                    {role}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User Card Actions / Stats */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <MfaBadges methods={user.authMethods} />

            {/* Collapsible sessions count pill */}
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border border-[var(--ink-14)] bg-[var(--paper-3)] hover:bg-[var(--paper-4)] transition-colors select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--ink-40)] rounded-sm"
              title={t('toggleSessionsTitle')}
              data-test-id={`toggle-sessions-${user.userId}`}
            >
              <span>{t('sessionsCount', { count: sessions.length })}</span>
              <span className={`inline-block transition-transform duration-200 text-[8px] text-[var(--ink-40)] ${expanded ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
          </div>

          {/* Revoke All (User) */}
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="ghost"
              type="button"
              onClick={onRevokeAll}
              disabled={pending}
              className="text-xs font-semibold py-1 px-2.5 h-auto text-[var(--cinnabar)] hover:bg-[var(--cinnabar-10)]"
              data-test-id={`revoke-all-user-${user.userId}`}
            >
              {t('revokeAll')}
            </Button>
            {error && (
              <span className="text-[10px] text-[var(--cinnabar)]">{error}</span>
            )}
            {status && (
              <span className="text-[10px] text-[var(--ink-55)]">{status}</span>
            )}
          </div>
        </div>
      </div>

      {/* Sessions Collapsible Body */}
      {expanded && (
        <div className="divide-y divide-[var(--ink-14)] bg-[var(--paper)] animate-[fadeIn_0.2s_ease-out]">
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              bundles={bundles}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SessionItem({
  session,
  bundles,
}: {
  session: SessionAdminRow
  bundles: Record<string, ReadonlyArray<string>>
}) {
  const t = useTranslations('SessionsAdmin.session')
  const tCard = useTranslations('SessionsAdmin.userCard')
  const tScopes = useTranslations('SessionsAdmin.scopes')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const { browser, os } = parseUa(session.userAgent)

  function onRevoke() {
    if (session.isOwnSession) {
      const ok = confirm(t('revokeOwnConfirm'))
      if (!ok) return
    }
    setError(null)
    setStatus(null)
    startTransition(async () => {
      const res = await revokeSessionAction(session.id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setStatus(t('revokedStatus'))
    })
  }

  // Group permissions by role based on bundles mapping
  const roleGroups = session.roles.map((role) => {
    const bundleScopes = bundles[role] || []
    const matchedScopes = session.permissions.filter((p) =>
      (bundleScopes as ReadonlyArray<string>).includes(p)
    )
    return {
      role,
      scopes: matchedScopes,
    }
  })

  // Collect all scopes that are matched to at least one role
  const matchedPermissions = new Set<string>()
  for (const group of roleGroups) {
    for (const s of group.scopes) {
      matchedPermissions.add(s)
    }
  }

  // Find remaining permissions (direct / other scopes)
  const otherScopes = session.permissions.filter((p) => !matchedPermissions.has(p))

  return (
    <div
      data-test-id={`session-item-${session.id}`}
      className="p-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4 text-sm hover:bg-[var(--paper-2)]/40 transition-colors"
    >
      {/* Session Device Context & Permissions */}
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {session.userAgent && (
            <InteractiveClientDetails
              userAgent={session.userAgent}
              browser={browser}
              os={os}
            />
          )}
          {session.isOwnSession && (
            <span className="text-xs text-[var(--cinnabar)] shrink-0 font-medium">
              {tCard('thisDevice')}
            </span>
          )}
          {session.ipHashShort && (
            <span
              className="font-mono text-[10px] text-[var(--ink-40)] shrink-0"
              title={t('ipTooltip')}
            >
              ip:{session.ipHashShort}
            </span>
          )}
          <span className="text-xs text-[var(--ink-14)] select-none shrink-0">•</span>
          <span className="font-mono text-[10px] text-[var(--ink-55)] shrink-0">
            {t('permissionsVersion', { version: session.permissionsVersion })}
          </span>
        </div>

        {/* Roles & Scopes Hierarchical Grouping */}
        <div className="mt-2 space-y-2 max-w-2xl" data-test-id="session-roles-scopes">
          {roleGroups.length === 0 && otherScopes.length === 0 ? (
            <span className="text-[10px] text-[var(--ink-40)] italic">{tScopes('empty')}</span>
          ) : (
            <>
              {roleGroups.map((group) => (
                <RoleGroupCard
                  key={group.role}
                  role={group.role}
                  scopes={group.scopes}
                />
              ))}
              {otherScopes.length > 0 && (
                <RoleGroupCard
                  role={tScopes('direct')}
                  scopes={otherScopes}
                  isDirect={true}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Time logs & specific Revoke Button */}
      <div className="flex flex-wrap items-center justify-between lg:justify-end gap-x-6 gap-y-2 shrink-0 lg:pt-1">
        <div className="flex flex-col text-left lg:text-right gap-0.5 min-w-[120px]">
          <span className="font-mono text-[10px] text-[var(--ink-70)]">
            {t('lastSeen', { when: session.lastSeenAt })}
          </span>
          <span className="font-mono text-[10px] text-[var(--ink-40)]">
            {t('expires', { when: session.expiresAt })}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1 min-w-[80px]">
          <Button
            variant="ghost"
            type="button"
            onClick={onRevoke}
            disabled={pending}
            className="text-xs font-semibold py-1 px-2.5 h-auto hover:bg-[var(--cinnabar-10)] text-[var(--cinnabar)]"
            data-test-id={`revoke-session-${session.id}`}
          >
            {t('revoke')}
          </Button>
          {error && (
            <span className="text-[10px] text-[var(--cinnabar)]">{error}</span>
          )}
          {status && (
            <span className="text-[10px] text-[var(--ink-55)]">{status}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function RoleGroupCard({
  role,
  scopes,
  isDirect = false,
}: {
  role: string
  scopes: string[]
  isDirect?: boolean
}) {
  const t = useTranslations('SessionsAdmin.scopes')
  const [expanded, setExpanded] = useState(true) // Default expanded for scan scannability

  // Test-ids stay stable across locales — use `direct` for the
  // localized "Direct / Other Scopes" group, the raw role key otherwise.
  const testIdKey = isDirect ? 'direct' : role

  return (
    <div className="border border-[var(--ink-14)] bg-[var(--paper-3)] rounded-sm overflow-hidden transition-all duration-200">
      {/* Header bar with role metadata & expand chevron */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[var(--paper-4)] transition-colors select-none"
        data-test-id={`role-group-${testIdKey}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isDirect ? (
            <svg
              className="h-3.5 w-3.5 text-[var(--ink-40)] shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 002.502-2.502m4.899-4.899a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1"
              />
            </svg>
          ) : (
            <svg
              className="h-3.5 w-3.5 text-[var(--ink-55)] shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          )}
          <span
            className={`font-mono text-xs font-semibold uppercase tracking-wider truncate ${
              isDirect ? 'text-[var(--ink-40)] italic' : 'text-[var(--ink-70)]'
            }`}
          >
            {role}
          </span>
          {!isDirect && (
            <span
              className="font-mono text-[8px] font-bold tracking-wider text-[var(--ink-40)] border border-[var(--ink-14)] px-1 rounded-sm uppercase bg-[var(--paper-2)] shrink-0 select-none"
              data-test-id="role-badge-indicator"
            >
              {t('roleBadge')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[9px] font-medium text-[var(--ink-55)] bg-[var(--paper-2)] border border-[var(--ink-14)] px-1.5 py-0.5 rounded-sm">
            {t('count', { count: scopes.length })}
          </span>
          <span
            className={`text-[8px] text-[var(--ink-40)] transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          >
            ▼
          </span>
        </div>
      </div>

      {/* Expanded scope badges */}
      {expanded && (
        <div className="p-3 bg-[var(--paper)] border-t border-[var(--ink-14)] flex flex-wrap gap-1.5 animate-[fadeIn_0.15s_ease-out]">
          {scopes.length === 0 ? (
            <span className="text-[10px] text-[var(--ink-40)] italic">{t('bundleEmpty')}</span>
          ) : (
            scopes.map((scope) => (
              <span
                key={scope}
                className="inline-flex items-center rounded-sm bg-[var(--paper-2)] border border-[var(--ink-14)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--ink-70)] leading-none select-all hover:border-[var(--ink-24)] transition-colors"
                title={t('copyTitle')}
              >
                {scope}
              </span>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function StateBadge({ state }: { state: ZitadelUserState | null }) {
  const t = useTranslations('SessionsAdmin.state')

  if (!state || state === 'unknown') {
    return (
      <span
        className="inline-flex items-center font-[family-name:var(--mono)] text-[9px] uppercase tracking-wider text-[var(--ink-40)]"
        title={t('unavailableTitle')}
      >
        {t('unavailableLabel')}
      </span>
    )
  }
  const tone =
    state === 'active'
      ? 'text-[var(--ink)]'
      : state === 'inactive'
        ? 'text-[var(--ink-55)]'
        : 'text-[var(--cinnabar)]'
  return (
    <span
      className={`inline-flex items-center font-[family-name:var(--mono)] text-[9px] uppercase tracking-wider ${tone}`}
      title={t('title')}
    >
      ● {state}
    </span>
  )
}

function MfaBadges({ methods }: { methods: AuthMethod[] }) {
  const t = useTranslations('SessionsAdmin.userCard')
  const mfa = methods.filter((m) => m !== 'password' && m !== 'idp')
  if (mfa.length === 0) {
    return (
      <span
        className="font-[family-name:var(--mono)] text-[9px] uppercase tracking-wider text-[var(--cinnabar)]"
        title={t('noMfaTitle')}
      >
        {t('noMfa')}
      </span>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {mfa.map((m) => (
        <span
          key={m}
          className="inline-flex items-center border border-[var(--ink-14)] px-1.5 py-0.5 font-[family-name:var(--mono)] text-[8px] uppercase tracking-wider text-[var(--ink)]"
        >
          {m.replace('_', ' ')}
        </span>
      ))}
    </div>
  )
}

function parseUa(raw: string | null): { browser: string; os: string } {
  if (!raw) return { browser: 'Browser', os: '' }
  const browser = /Edg\/\d/.test(raw)
    ? 'Edge'
    : /OPR\/\d/.test(raw)
      ? 'Opera'
      : /Chrome\/\d/.test(raw)
        ? 'Chrome'
        : /Firefox\/\d/.test(raw)
          ? 'Firefox'
          : /Safari\/\d/.test(raw) && !/Chrome/.test(raw)
            ? 'Safari'
            : 'Browser'
  const os = /iPhone|iPad/.test(raw)
    ? 'iOS'
    : /Android/.test(raw)
      ? 'Android'
      : /Mac OS X/.test(raw)
        ? 'macOS'
        : /Windows/.test(raw)
          ? 'Windows'
          : /Linux/.test(raw)
            ? 'Linux'
            : ''
  return { browser, os }
}

/**
 * Browser/OS hint — same logic as `stats.ts::parseBrowser/parseOs`,
 * kept here for a single rendered string per row. Keep in sync.
 */
function shortUa(raw: string | null): string {
  const { browser, os } = parseUa(raw)
  return os ? `${browser} · ${os}` : browser
}

function InteractiveClientDetails({
  userAgent,
  browser,
  os,
}: {
  userAgent: string | null
  browser: string
  os: string
}) {
  const t = useTranslations('SessionsAdmin.client')
  const [showName, setShowName] = useState(false)

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => setShowName(!showName)}
        className="inline-flex items-center h-6 rounded-full border border-[var(--ink-14)] bg-[var(--paper-2)] hover:bg-[var(--paper-3)] active:bg-[var(--paper-4)] transition-all duration-150 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--ink-40)] px-2 gap-1.5 select-none"
        title={t('toggleTitle')}
      >
        <BrowserIcon name={browser} className="h-3.5 w-3.5 shrink-0" />
        {os && (
          <>
            <span className="text-[var(--ink-14)] text-[10px] select-none shrink-0">·</span>
            <OsIcon name={os} className="h-3.5 w-3.5 shrink-0" />
          </>
        )}
        {showName && (
          <>
            <span className="h-3 w-px bg-[var(--ink-14)] select-none shrink-0" />
            <span className="text-[9px] font-mono tracking-tight text-[var(--ink-55)] shrink-0 animate-[fadeIn_0.15s_ease-out]">
              {shortUa(userAgent)}
            </span>
          </>
        )}
      </button>
    </div>
  )
}
