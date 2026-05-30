import { getTranslations } from 'next-intl/server'
import { requireScope } from '@iedora/product-core'
import { SCOPES } from '@iedora/auth/scopes'
import { listManualPayments, listProductPlans } from '@iedora/billing'
import { getTenantById } from '@iedora/auth'
import { PRODUCTS } from '@iedora/brand'
import { AdminPage } from '@iedora/product-core/shared/ui/admin-page'
import { PaymentsAdmin } from './payments-admin'

/**
 * Cross-tenant ledger of admin-recorded offline payments. Gated by
 * `staff:core:billing:manage` (held by iedora-admin only — held by
 * no tenant user). Server hydrates the initial list + tenant name
 * map; client owns the form + filter state.
 */
export default async function PaymentsPage() {
  await requireScope(SCOPES.core.staff.billing.manage)
  const t = await getTranslations('Core.admin.payments')

  // Initial unfiltered slice — the client can re-fetch as filters
  // change. 200 fits the foreseeable manual-payment ledger size; if
  // we cross that we add pagination.
  const initialRows = await listManualPayments({ limit: 200 })

  // Hydrate a tenant-name lookup for the page. The list shows tenant
  // names, not raw ids — without this map the client would do N+1.
  const tenantIds = Array.from(new Set(initialRows.map((r) => r.tenantId)))
  const tenantNames: Record<string, string> = {}
  await Promise.all(
    tenantIds.map(async (id) => {
      const tenant = await getTenantById(id)
      if (tenant) tenantNames[id] = tenant.name
    }),
  )

  // Plan list pricing — the form + list use it for discount math.
  // Today only the `menu` product is commercialised; when imopush goes
  // paid this turns into an iteration over PRODUCTS. Sent flat as
  // `code → monthlyCents` so the client never imports server code.
  const planPrices: Record<string, number> = {}
  const planLabels: Record<string, string> = {}
  for (const p of listProductPlans(PRODUCTS.menu)) {
    planPrices[p.code] = p.monthlyCents
    planLabels[p.code] = p.name
  }

  // Initial payload normalises Date → ISO string so the client/server
  // boundary doesn't fight over JSON serialisation of Date.
  const initialPayments = initialRows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    product: r.product,
    planCode: r.planCode,
    paidAt: r.paidAt.toISOString(),
    validMonths: r.validMonths,
    amountCents: r.amountCents,
    currency: r.currency,
    method: r.method,
    campaignTag: r.campaignTag,
    notes: r.notes,
    createdByUserId: r.createdByUserId,
    createdAt:
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : new Date(r.createdAt).toISOString(),
  }))

  return (
    <AdminPage
      crumbs={[{ label: t('crumbAdmin'), href: '/core/admin', testId: 'admin' }]}
      title={t('title')}
      description={t('description')}
      data-test-id="admin-payments-page"
    >
      <PaymentsAdmin
        initialPayments={initialPayments}
        tenantNames={tenantNames}
        planPrices={planPrices}
        planLabels={planLabels}
      />
    </AdminPage>
  )
}
