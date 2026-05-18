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
import { listUsers } from '@/features/admin/use-cases/list-users'
import { PageHead, Mono } from '../_lib/editorial'
import { SearchBox } from '../_lib/search-box'

export const metadata = { title: 'Users · Admin' }

type SearchParams = Promise<{ q?: string }>

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('en-CA').format(d) // YYYY-MM-DD
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireAdmin('/admin/users')
  const { q } = await searchParams
  const users = await listUsers({ search: q })

  return (
    <>
      <PageHead
        eyebrow="/ 01  Users"
        title="Every account."
        note="The platform’s population. Click a row to inspect, ban, set a role, or impersonate."
        actions={<SearchBox placeholder="Search by email or name" />}
      />

      {users.length === 0 ? (
        <EmptyState
          label="No matches"
          note={
            q
              ? `Nothing matches “${q}”. Try a different query.`
              : 'No users yet.'
          }
        />
      ) : (
        <div className="admin-table-scroll"><Table>
          <thead>
            <tr>
              <Th style={{ width: '4ch' }}>N</Th>
              <Th>Email</Th>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id}>
                <Td>
                  <TableRowNum>{String(i + 1).padStart(2, '0')}</TableRowNum>
                </Td>
                <Td>
                  <Link
                    href={`/admin/users/${u.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    {u.email}
                  </Link>
                </Td>
                <Td>{u.name || <Mono>—</Mono>}</Td>
                <Td>
                  <Mono>{u.role ?? 'user'}</Mono>
                </Td>
                <Td>
                  {u.banned ? (
                    <Badge variant="accent">Banned</Badge>
                  ) : (
                    <Badge variant="live">Active</Badge>
                  )}
                </Td>
                <Td>
                  <Mono>{fmtDate(u.createdAt)}</Mono>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table></div>
      )}
    </>
  )
}
