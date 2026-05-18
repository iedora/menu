import Link from 'next/link'
import {
  EmptyState,
  Table,
  TableRowNum,
  Td,
  Th,
} from '@iedora/design-system'
import { requireAdmin } from '@/features/admin'
import { listOrganizations } from '@/features/admin/use-cases/list-organizations'
import { PageHead, Mono } from '../_lib/editorial'
import { SearchBox } from '../_lib/search-box'
import { CreateOrganizationDialog } from './organizations-actions.client'

export const metadata = { title: 'Organizations · Admin' }

type SearchParams = Promise<{ q?: string }>

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('en-CA').format(d)
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireAdmin('/admin/organizations')
  const { q } = await searchParams
  const orgs = await listOrganizations({ search: q })

  return (
    <>
      <PageHead
        eyebrow="/ 02  Organizations"
        title="The tenants."
        note="Each row is a Better Auth organization. Open one to manage members + invitations."
        actions={
          <>
            <SearchBox placeholder="Search by name or slug" />
            <CreateOrganizationDialog />
          </>
        }
      />

      {orgs.length === 0 ? (
        <EmptyState
          label="No matches"
          note={q ? `Nothing matches “${q}”.` : 'No organizations yet.'}
        />
      ) : (
        <div className="admin-table-scroll"><Table>
          <thead>
            <tr>
              <Th style={{ width: '4ch' }}>N</Th>
              <Th>Name</Th>
              <Th>Slug</Th>
              <Th>Members</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o, i) => (
              <tr key={o.id}>
                <Td>
                  <TableRowNum>{String(i + 1).padStart(2, '0')}</TableRowNum>
                </Td>
                <Td>
                  <Link
                    href={`/admin/organizations/${o.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    {o.name}
                  </Link>
                </Td>
                <Td>
                  <Mono>{o.slug}</Mono>
                </Td>
                <Td>
                  <Mono>{o.membersCount}</Mono>
                </Td>
                <Td>
                  <Mono>{fmtDate(o.createdAt)}</Mono>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table></div>
      )}
    </>
  )
}
