import Link from 'next/link'
import {
  Badge,
  EmptyState,
  Table,
  TableRowNum,
  Td,
  Th,
} from '@iedora/design-system'
import { requireAdmin } from '@/features/admin'
import { listAllActiveSessions } from '@/features/admin/use-cases/list-sessions'
import { Mono, PageHead } from '../_lib/editorial'
import { RevokeAnySessionButton } from './sessions-actions.client'

export const metadata = { title: 'Sessions · Admin' }

function fmtDateTime(d: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default async function AdminSessionsPage() {
  await requireAdmin('/admin/sessions')
  const sessions = await listAllActiveSessions()

  return (
    <>
      <PageHead
        eyebrow="/ 05  Sessions"
        title="Every device, signed in."
        note="Active platform sessions across all users. Revoke individually."
      />

      {sessions.length === 0 ? (
        <EmptyState label="No active sessions" note="Nobody is signed in right now." />
      ) : (
        <div className="admin-table-scroll"><Table>
          <thead>
            <tr>
              <Th style={{ width: '4ch' }}>N</Th>
              <Th>User</Th>
              <Th>IP</Th>
              <Th>User agent</Th>
              <Th>Created</Th>
              <Th>Expires</Th>
              <Th style={{ textAlign: 'right' }}>Action</Th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={s.id}>
                <Td>
                  <TableRowNum>{String(i + 1).padStart(2, '0')}</TableRowNum>
                </Td>
                <Td>
                  <Link
                    href={`/admin/users/${s.userId}`}
                    style={{ textDecoration: 'none' }}
                  >
                    {s.userEmail}
                  </Link>
                  {s.impersonatedBy ? (
                    <>
                      {' '}
                      <Badge variant="ghost">Impersonated</Badge>
                    </>
                  ) : null}
                </Td>
                <Td>
                  <Mono>{s.ipAddress ?? '—'}</Mono>
                </Td>
                <Td
                  title={s.userAgent ?? ''}
                  style={{
                    maxWidth: 320,
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
                <Td style={{ textAlign: 'right' }}>
                  <RevokeAnySessionButton sessionToken={s.token} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table></div>
      )}
    </>
  )
}
