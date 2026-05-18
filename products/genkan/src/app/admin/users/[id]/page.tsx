import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Badge,
  EmptyState,
  Separator,
  Table,
  Td,
  Th,
} from '@iedora/design-system'
import { requireAdmin } from '@/features/admin'
import {
  getUserById,
  listOrganizationsForUser,
  listSessionsForUser,
} from '@/features/admin/use-cases/list-users'
import { Eyebrow, Mono, PageHead } from '../../_lib/editorial'
import { UserActions, RoleForm, BanForm, RevokeSessionButton } from './user-actions.client'

export const metadata = { title: 'User · Admin' }

type Params = Promise<{ id: string }>

function fmtDateTime(d: Date | null | undefined) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Params
}) {
  const { id } = await params
  await requireAdmin(`/admin/users/${id}`)
  const user = await getUserById(id)
  if (!user) notFound()

  const [sessions, orgs] = await Promise.all([
    listSessionsForUser(id),
    listOrganizationsForUser(id),
  ])

  return (
    <>
      <PageHead
        eyebrow={
          <>
            <Link
              href="/admin/users"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              / 01  Users
            </Link>{' '}
            ·{' '}
            <Mono style={{ color: 'var(--ink-55)' }}>
              {user.email}
            </Mono>
          </>
        }
        title={user.name || user.email}
        note={
          user.banned ? (
            <>
              <Badge variant="accent">Banned</Badge>{' '}
              <em>{user.banReason ?? 'No reason recorded.'}</em>
            </>
          ) : (
            <em>Account is active.</em>
          )
        }
        actions={<UserActions userId={user.id} banned={user.banned} />}
      />

      {/* Identity block ---------------------------------------------------- */}
      <section style={{ marginBottom: 48 }}>
        <Eyebrow>/ Identity</Eyebrow>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr',
            gap: '12px 36px',
            margin: '12px 0 0',
            fontFamily: 'var(--serif)',
          }}
        >
          <dt style={dtStyle}>User ID</dt>
          <dd style={ddStyle}>
            <Mono>{user.id}</Mono>
          </dd>
          <dt style={dtStyle}>Email</dt>
          <dd style={ddStyle}>{user.email}</dd>
          <dt style={dtStyle}>Email verified</dt>
          <dd style={ddStyle}>
            {user.emailVerified ? 'Yes' : <Mono>—</Mono>}
          </dd>
          <dt style={dtStyle}>Name</dt>
          <dd style={ddStyle}>{user.name || <Mono>—</Mono>}</dd>
          <dt style={dtStyle}>Created</dt>
          <dd style={ddStyle}>
            <Mono>{fmtDateTime(user.createdAt)}</Mono>
          </dd>
          <dt style={dtStyle}>Updated</dt>
          <dd style={ddStyle}>
            <Mono>{fmtDateTime(user.updatedAt)}</Mono>
          </dd>
          {user.banExpires ? (
            <>
              <dt style={dtStyle}>Ban expires</dt>
              <dd style={ddStyle}>
                <Mono>{fmtDateTime(user.banExpires)}</Mono>
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      <Separator />

      {/* Role ------------------------------------------------------------- */}
      <section style={{ margin: '36px 0' }}>
        <Eyebrow>/ Role</Eyebrow>
        <p
          style={{
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            color: 'var(--ink-70)',
            margin: '12px 0 16px',
          }}
        >
          Setting <Mono>admin</Mono> grants this user the entire /admin
          surface. Setting <Mono>user</Mono> revokes it.
        </p>
        <RoleForm userId={user.id} currentRole={user.role ?? 'user'} />
      </section>

      <Separator />

      {/* Ban / Unban ------------------------------------------------------ */}
      <section style={{ margin: '36px 0' }}>
        <Eyebrow>/ Ban</Eyebrow>
        <p
          style={{
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            color: 'var(--ink-70)',
            margin: '12px 0 16px',
          }}
        >
          Banning invalidates every session and blocks new sign-ins. The
          reason is recorded on the row.
        </p>
        <BanForm
          userId={user.id}
          banned={user.banned}
          banReason={user.banReason}
        />
      </section>

      <Separator />

      {/* Sessions --------------------------------------------------------- */}
      <section style={{ margin: '36px 0' }}>
        <Eyebrow>/ Sessions</Eyebrow>
        {sessions.length === 0 ? (
          <div style={{ marginTop: 16 }}>
            <EmptyState label="No sessions" note="No active or expired sessions for this user." />
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div className="admin-table-scroll"><Table>
              <thead>
                <tr>
                  <Th>IP</Th>
                  <Th>User agent</Th>
                  <Th>Created</Th>
                  <Th>Expires</Th>
                  <Th>Impersonated</Th>
                  <Th style={{ textAlign: 'right' }}>Action</Th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <Mono>{s.ipAddress ?? '—'}</Mono>
                    </Td>
                    <Td
                      title={s.userAgent ?? ''}
                      style={{
                        maxWidth: 360,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Mono>{s.userAgent ?? '—'}</Mono>
                    </Td>
                    <Td>
                      <Mono>{fmtDateTime(s.createdAt)}</Mono>
                    </Td>
                    <Td>
                      <Mono>{fmtDateTime(s.expiresAt)}</Mono>
                    </Td>
                    <Td>
                      {s.impersonatedBy ? (
                        <Badge variant="ghost">By {s.impersonatedBy.slice(0, 8)}…</Badge>
                      ) : (
                        <Mono>—</Mono>
                      )}
                    </Td>
                    <Td style={{ textAlign: 'right' }}>
                      <RevokeSessionButton
                        userId={user.id}
                        sessionToken={s.token}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table></div>
          </div>
        )}
      </section>

      <Separator />

      {/* Organizations ---------------------------------------------------- */}
      <section style={{ margin: '36px 0' }}>
        <Eyebrow>/ Organizations</Eyebrow>
        {orgs.length === 0 ? (
          <div style={{ marginTop: 16 }}>
            <EmptyState label="No memberships" note="This user belongs to no organization." />
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div className="admin-table-scroll"><Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Slug</Th>
                  <Th>Role</Th>
                  <Th>Joined</Th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.organizationId}>
                    <Td>
                      <Link
                        href={`/admin/organizations/${o.organizationId}`}
                        style={{ textDecoration: 'none' }}
                      >
                        {o.organizationName}
                      </Link>
                    </Td>
                    <Td>
                      <Mono>{o.organizationSlug}</Mono>
                    </Td>
                    <Td>
                      <Mono>{o.role}</Mono>
                    </Td>
                    <Td>
                      <Mono>{fmtDateTime(o.createdAt)}</Mono>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table></div>
          </div>
        )}
      </section>
    </>
  )
}

const dtStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 10.5,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--ink-55)',
  alignSelf: 'baseline',
  paddingTop: 4,
}

const ddStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--serif)',
  fontSize: 16,
  color: 'var(--ink)',
}
