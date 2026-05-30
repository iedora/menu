import Link from 'next/link'
import { requireScope } from '@iedora/product-menu/features/auth'
import { SCOPES } from '@iedora/auth/scopes'
import { getTenantById } from '@iedora/auth'
import { DashboardPage } from '@iedora/product-menu/shared/ui/dashboard-page'
import { listRestaurantsAdmin } from '@iedora/product-menu/features/restaurant-identity'
import { CreateRestaurantForm } from './create-restaurant-form'

/**
 * Cross-tenant restaurants admin. Lists every restaurant with its
 * tenant + a transfer link, and lets admin spin up a fresh tenant +
 * restaurant from a single form.
 *
 * Gated on `staff:menu:restaurants:transfer` — the same scope that
 * marks "admin manages restaurants cross-tenant" (auto-included in
 * the iedora-admin preset via the staff:* wildcard).
 */
export default async function AdminRestaurantsPage() {
  await requireScope(SCOPES.menu.staff.restaurants.transfer)

  const rows = await listRestaurantsAdmin()

  // Hydrate tenant names in one pass — table renders names, not raw
  // ids. Cross-DB call so we batch via Promise.all to keep latency flat.
  const tenantIds = Array.from(new Set(rows.map((r) => r.tenantId)))
  const tenantNames: Record<string, string> = {}
  await Promise.all(
    tenantIds.map(async (id) => {
      const t = await getTenantById(id)
      if (t) tenantNames[id] = t.name
    }),
  )

  return (
    <DashboardPage
      title="Restaurantes"
      description="Cross-tenant. Cria um restaurante novo (com tenant próprio) ou abre/transfere os existentes."
      data-test-id="admin-restaurants"
    >
      <section data-test-id="admin-restaurants-create">
        <CreateRestaurantForm />
      </section>

      <section
        className="space-y-3"
        aria-labelledby="admin-restaurants-list-heading"
        data-test-id="admin-restaurants-list"
      >
        <h2
          id="admin-restaurants-list-heading"
          className="font-[family-name:var(--serif)] text-lg"
        >
          Todos os restaurantes
        </h2>

        {rows.length === 0 ? (
          <p className="rounded border border-[var(--ink-14)] bg-[var(--paper-2)] px-4 py-6 text-center text-sm text-[var(--ink-55)]">
            Ainda não há restaurantes na plataforma.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded border border-[var(--ink-14)] bg-[var(--paper)] p-4 space-y-3"
                data-test-id={`admin-restaurants-row-${r.slug}`}
              >
                <header className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{r.name}</p>
                    <p className="text-xs text-[var(--ink-55)]">
                      {tenantNames[r.tenantId] ?? r.tenantId} ·{' '}
                      <code>{r.slug}</code>
                    </p>
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-55)] font-[family-name:var(--mono)]">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </header>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/menu/dashboard/r/${r.slug}`}
                    className="rounded border border-[var(--ink-14)] px-3 py-2 text-xs hover:bg-[var(--paper-2)]"
                    data-test-id={`admin-restaurants-open-${r.slug}`}
                  >
                    Abrir
                  </Link>
                  <Link
                    href={`/menu/dashboard/r/${r.slug}/transfer`}
                    className="rounded bg-[var(--ink)] px-3 py-2 text-xs text-[var(--paper)]"
                    data-test-id={`admin-restaurants-transfer-${r.slug}`}
                  >
                    Transferir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardPage>
  )
}
