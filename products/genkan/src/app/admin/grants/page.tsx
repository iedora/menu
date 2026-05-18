import Link from 'next/link'
import {
  EmptyState,
  Table,
  TableRowNum,
  Td,
  Th,
} from '@iedora/design-system'
import { requireAdmin } from '@/features/admin'
import { listGrants } from '@/features/admin/use-cases/list-grants'
import { Mono, PageHead } from '../_lib/editorial'
import { RevokeGrantButton } from './grants-actions.client'

export const metadata = { title: 'Grants · Admin' }

type SearchParams = Promise<{ userId?: string; clientId?: string }>

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

export default async function AdminGrantsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireAdmin('/admin/grants')
  const { userId, clientId } = await searchParams
  const grants = await listGrants({ userId, clientId })

  const filterLabel =
    userId || clientId
      ? `Filtered by ${userId ? `user ${userId}` : ''}${userId && clientId ? ' + ' : ''}${clientId ? `client ${clientId}` : ''}.`
      : null

  return (
    <>
      <PageHead
        eyebrow="/ 04  Grants"
        title="Consents."
        note={
          filterLabel ? (
            <>
              {filterLabel}{' '}
              <Link
                href="/admin/grants"
                style={{ color: 'var(--cinnabar)', textDecoration: 'none' }}
              >
                Clear filter
              </Link>
            </>
          ) : (
            <em>
              Every scope grant a user has given a client. Revoke a row to
              nullify tokens and force a fresh consent.
            </em>
          )
        }
      />

      {grants.length === 0 ? (
        <EmptyState label="No grants" note="No consent rows match the current filter." />
      ) : (
        <div className="admin-table-scroll"><Table>
          <thead>
            <tr>
              <Th style={{ width: '4ch' }}>N</Th>
              <Th>User</Th>
              <Th>Application</Th>
              <Th>Scope</Th>
              <Th>Granted</Th>
              <Th style={{ textAlign: 'right' }}>Action</Th>
            </tr>
          </thead>
          <tbody>
            {grants.map((g, i) => (
              <tr key={g.id}>
                <Td>
                  <TableRowNum>{String(i + 1).padStart(2, '0')}</TableRowNum>
                </Td>
                <Td>
                  {g.userId ? (
                    <Link
                      href={`/admin/users/${g.userId}`}
                      style={{ textDecoration: 'none' }}
                    >
                      {g.userEmail ?? g.userId}
                    </Link>
                  ) : (
                    <Mono>—</Mono>
                  )}
                </Td>
                <Td>
                  <Mono>{g.clientName ?? g.clientId}</Mono>
                </Td>
                <Td>
                  <Mono>{g.scopes.join(' ') || '—'}</Mono>
                </Td>
                <Td>
                  <Mono>{fmtDateTime(g.createdAt)}</Mono>
                </Td>
                <Td style={{ textAlign: 'right' }}>
                  <RevokeGrantButton consentId={g.id} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table></div>
      )}
    </>
  )
}
