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
  getOrganizationById,
  listInvitationsForOrganization,
  listMembersForOrganization,
} from '@/features/admin/use-cases/list-organizations'
import { Eyebrow, Mono, PageHead } from '../../_lib/editorial'
import {
  DeleteOrganizationDialog,
  IdentityForm,
  InviteForm,
  CancelInvitationButton,
  RemoveMemberButton,
} from './organization-actions.client'

export const metadata = { title: 'Organization · Admin' }

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

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Params
}) {
  const { id } = await params
  await requireAdmin(`/admin/organizations/${id}`)
  const org = await getOrganizationById(id)
  if (!org) notFound()

  const [members, invitations] = await Promise.all([
    listMembersForOrganization(id),
    listInvitationsForOrganization(id),
  ])

  return (
    <>
      <PageHead
        eyebrow={
          <>
            <Link
              href="/admin/organizations"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              / 02  Organizations
            </Link>{' '}
            ·{' '}
            <Mono style={{ color: 'var(--ink-55)' }}>{org.slug}</Mono>
          </>
        }
        title={org.name}
        note={
          <em>
            Created {fmtDateTime(org.createdAt)} ·{' '}
            <Mono>{org.id}</Mono>
          </em>
        }
        actions={<DeleteOrganizationDialog organizationId={org.id} name={org.name} />}
      />

      {/* Identity --------------------------------------------------------- */}
      <section style={{ marginBottom: 48 }}>
        <Eyebrow>/ Identity</Eyebrow>
        <div style={{ marginTop: 16 }}>
          <IdentityForm
            organizationId={org.id}
            initialName={org.name}
            initialSlug={org.slug}
          />
        </div>
      </section>

      <Separator />

      {/* Members ---------------------------------------------------------- */}
      <section style={{ margin: '36px 0' }}>
        <Eyebrow>/ Members</Eyebrow>
        {members.length === 0 ? (
          <div style={{ marginTop: 16 }}>
            <EmptyState label="No members" note="This organization is empty." />
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div className="admin-table-scroll"><Table>
              <thead>
                <tr>
                  <Th>Email</Th>
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th>Joined</Th>
                  <Th style={{ textAlign: 'right' }}>Action</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <Td>
                      <Link
                        href={`/admin/users/${m.userId}`}
                        style={{ textDecoration: 'none' }}
                      >
                        {m.email}
                      </Link>
                    </Td>
                    <Td>{m.name || <Mono>—</Mono>}</Td>
                    <Td>
                      <Mono>{m.role}</Mono>
                    </Td>
                    <Td>
                      <Mono>{fmtDateTime(m.createdAt)}</Mono>
                    </Td>
                    <Td style={{ textAlign: 'right' }}>
                      <RemoveMemberButton
                        organizationId={org.id}
                        memberIdOrEmail={m.email}
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

      {/* Invite ----------------------------------------------------------- */}
      <section style={{ margin: '36px 0' }}>
        <Eyebrow>/ Invite</Eyebrow>
        <p
          style={{
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            color: 'var(--ink-70)',
            margin: '12px 0 16px',
          }}
        >
          Sends an invitation that the recipient accepts via the regular flow.
        </p>
        <InviteForm organizationId={org.id} />
      </section>

      <Separator />

      {/* Invitations ------------------------------------------------------ */}
      <section style={{ margin: '36px 0' }}>
        <Eyebrow>/ Invitations</Eyebrow>
        {invitations.length === 0 ? (
          <div style={{ marginTop: 16 }}>
            <EmptyState label="No invitations" note="None pending or expired." />
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div className="admin-table-scroll"><Table>
              <thead>
                <tr>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Expires</Th>
                  <Th>Inviter</Th>
                  <Th style={{ textAlign: 'right' }}>Action</Th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <Td>{inv.email}</Td>
                    <Td>
                      <Mono>{inv.role ?? 'member'}</Mono>
                    </Td>
                    <Td>
                      <Badge
                        variant={
                          inv.status === 'pending'
                            ? 'live'
                            : inv.status === 'accepted'
                              ? 'ink'
                              : 'ghost'
                        }
                      >
                        {inv.status}
                      </Badge>
                    </Td>
                    <Td>
                      <Mono>{fmtDateTime(inv.expiresAt)}</Mono>
                    </Td>
                    <Td>
                      <Mono>{inv.inviterEmail ?? '—'}</Mono>
                    </Td>
                    <Td style={{ textAlign: 'right' }}>
                      <CancelInvitationButton
                        organizationId={org.id}
                        invitationId={inv.id}
                      />
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
