import Link from 'next/link'
import { Badge, EmptyState, Table, TableRowNum, Td, Th } from '@iedora/design-system'
import { requireAdmin } from '@/features/admin'
import { listAdminSubscriptions } from '@/features/webhooks'
import { Mono, PageHead } from '../_lib/editorial'
import { RegisterSubscriptionDialog } from './webhooks-actions.client'

export const metadata = { title: 'Webhooks · Admin' }

function fmtDate(d: Date | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-CA').format(d)
}

export default async function AdminWebhooksPage() {
  await requireAdmin('/admin/webhooks')
  const subs = await listAdminSubscriptions()

  return (
    <>
      <PageHead
        eyebrow="/ 04  Webhooks"
        title="Identity webhooks."
        note="Signed POSTs go to every enabled subscription. The shared HMAC secret is generated when you register; copy it into the receiver's env."
        actions={<RegisterSubscriptionDialog />}
      />

      {subs.length === 0 ? (
        <EmptyState
          label="No subscriptions"
          note="No products are listening yet. Register one to start delivering events."
        />
      ) : (
        <div className="admin-table-scroll"><Table>
          <thead>
            <tr>
              <Th style={{ width: '4ch' }}>N</Th>
              <Th>Name</Th>
              <Th>URL</Th>
              <Th>Events</Th>
              <Th>Status</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s, i) => (
              <tr key={s.id}>
                <Td>
                  <TableRowNum>{String(i + 1).padStart(2, '0')}</TableRowNum>
                </Td>
                <Td>
                  <Link
                    href={`/admin/webhooks/${s.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    {s.name ?? <Mono>—</Mono>}
                  </Link>
                </Td>
                <Td>
                  <Mono>{s.url}</Mono>
                </Td>
                <Td>
                  <Mono>
                    {s.events === null
                      ? 'all'
                      : s.events.length === 0
                        ? '—'
                        : s.events.join(' ')}
                  </Mono>
                </Td>
                <Td>
                  {s.enabled ? (
                    <Badge variant="ink">Enabled</Badge>
                  ) : (
                    <Badge variant="ghost">Disabled</Badge>
                  )}
                </Td>
                <Td>
                  <Mono>{fmtDate(s.createdAt)}</Mono>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table></div>
      )}
    </>
  )
}
