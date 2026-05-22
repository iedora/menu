// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/messages/en.json'
import { SessionsAdmin, type SessionAdminRow } from './sessions-admin'

// Mock the server actions to prevent 'server-only' imports from crashing JSDOM tests
vi.mock('../actions', () => ({
  revokeAllForUserAction: vi.fn(),
  revokeSessionAction: vi.fn(),
}))

function renderWithIntl(node: React.ReactNode) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      {node}
    </NextIntlClientProvider>,
  )
}

const mockStats = {
  total: 1,
  uniqueUsers: 1,
  last24h: 1,
  staleCount: 0,
  avgAgeHours: 1.5,
  permissionVersionMax: 1,
  browsers: [],
  operatingSystems: [],
}

const mockRow: SessionAdminRow = {
  id: 'session-1',
  userId: 'user-1',
  email: 'dev@iedora.local',
  displayName: 'iedora Admin',
  username: 'zitadel-admin',
  state: 'active',
  emailVerified: true,
  roles: ['iedora-admin'],
  permissions: ['qr-codes:read', 'qr-codes:write', 'some-other-scope'],
  permissionsVersion: 1,
  createdAt: '2026-05-22T10:00:00Z',
  lastSeenAt: '2m ago',
  expiresAt: '2026-05-29',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ipHashShort: 'eff8e7ca5066',
  authMethods: ['password', 'totp'],
  isOwnSession: true,
}

describe('SessionsAdmin UI Grouping', () => {
  it('groups scopes under their matching role bundle and shows roles clearly', () => {
    const bundles = {
      'iedora-admin': ['qr-codes:read', 'qr-codes:write'],
    }

    const html = renderWithIntl(
      <SessionsAdmin
        rows={[mockRow]}
        stats={mockStats}
        snapshotAt="2026-05-22T12:00:00Z"
        bundles={bundles}
      />,
    )

    // Check that we have the role group card for iedora-admin
    expect(html).toContain('data-test-id="role-group-iedora-admin"')
    expect(html).toContain('iedora-admin')

    // Check that the ROLE badge indicator is rendered next to the role name
    expect(html).toContain('data-test-id="role-badge-indicator"')
    expect(html).toContain('>Role</span>')

    // iedora-admin bundle has ALL_SCOPES (qr-codes:read, qr-codes:write)
    expect(html).toContain('>qr-codes:read</span>')
    expect(html).toContain('>qr-codes:write</span>')

    // The "Direct / Other Scopes" group uses the locale-stable
    // `direct` test-id, not the localized label.
    expect(html).toContain('data-test-id="role-group-direct"')
    expect(html).toContain('>some-other-scope</span>')

    // Check that top-level user card header lists user's roles
    expect(html).toContain('data-test-id="user-roles-list"')
    expect(html).toContain('title="Role: iedora-admin"')
  })

  it('renders "No scopes granted" when session permissions is empty', () => {
    const emptyScopesRow: SessionAdminRow = {
      ...mockRow,
      roles: [],
      permissions: [],
    }

    const html = renderWithIntl(
      <SessionsAdmin rows={[emptyScopesRow]} stats={mockStats} snapshotAt="2026-05-22T12:00:00Z" />,
    )

    expect(html).toContain('No scopes granted')
  })
})
