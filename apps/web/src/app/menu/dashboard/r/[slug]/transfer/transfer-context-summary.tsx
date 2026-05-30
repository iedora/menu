import { getTranslations } from 'next-intl/server'
import type { TransferContext } from '@iedora/product-menu/features/restaurant-identity'

/**
 * Read-only summary panel above the transfer wizard. Shows everything
 * pertinent about the restaurant right now: the restaurant itself, the
 * tenant it lives in, and the people who hold membership in that
 * tenant (with their detected role). Lets the admin double-check
 * before signing off on a transfer.
 *
 * Server component — pure rendering, no interactivity. Members list
 * is already fully resolved by `getRestaurantTransferContext`.
 */
export async function TransferContextSummary({
  context,
  locale,
}: {
  context: TransferContext
  locale: string
}) {
  const t = await getTranslations('RestaurantTransfer.context')
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const owners = context.members.filter((m) => m.role === 'owner')
  const others = context.members.filter((m) => m.role !== 'owner')

  return (
    <section
      className="rounded border border-[var(--ink-14)] bg-[var(--paper-2)] p-4 space-y-4"
      aria-labelledby="transfer-context-heading"
      data-test-id="transfer-context-summary"
    >
      <header>
        <h2
          id="transfer-context-heading"
          className="font-[family-name:var(--serif)] text-lg"
        >
          {t('heading')}
        </h2>
        <p className="text-sm text-[var(--ink-55)]">{t('subtitle')}</p>
      </header>

      <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
        <dt className="text-[var(--ink-55)]">{t('restaurantName')}</dt>
        <dd className="truncate">{context.restaurant.name}</dd>

        <dt className="text-[var(--ink-55)]">{t('restaurantSlug')}</dt>
        <dd className="truncate font-[family-name:var(--mono)]">
          {context.restaurant.slug}
        </dd>

        <dt className="text-[var(--ink-55)]">{t('restaurantCreated')}</dt>
        <dd className="tabular-nums">
          {dateFmt.format(context.restaurant.createdAt)}
        </dd>

        <dt className="text-[var(--ink-55)]">{t('tenantName')}</dt>
        <dd className="truncate">{context.tenant.name}</dd>

        <dt className="text-[var(--ink-55)]">{t('tenantCreated')}</dt>
        <dd className="tabular-nums">
          {dateFmt.format(context.tenant.createdAt)}
        </dd>
      </dl>

      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-[var(--ink-55)] mb-2">
          {t('membersHeading', { count: context.members.length })}
        </h3>
        {context.members.length === 0 ? (
          <p className="text-sm text-[var(--ink-55)]">{t('membersEmpty')}</p>
        ) : (
          <ul
            className="divide-y divide-[var(--ink-14)] border border-[var(--ink-14)] rounded bg-[var(--paper)]"
            data-test-id="transfer-context-members"
          >
            {[...owners, ...others].map((m) => (
              <li
                key={m.userId}
                className="flex items-center gap-3 px-3 py-2"
                data-test-id={`transfer-context-member-${m.userId}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{m.name || m.email}</p>
                  {m.name && (
                    <p className="truncate text-xs text-[var(--ink-55)]">
                      {m.email}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                    m.role === 'owner'
                      ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                      : 'border-[var(--ink-40)] text-[var(--ink-55)]'
                  }`}
                  data-test-id={`transfer-context-member-role-${m.userId}`}
                >
                  {t(`role.${m.role}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
