import { expect, test } from '../../fixtures'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'
import { testDb } from '../../helpers/db'

/**
 * Billing page covers two distinct things on one screen:
 *  - current plan + the placeholder upgrade flow (no Stripe yet);
 *  - an invoice ledger filtered by year.
 *
 * The year filter is the load-bearing assertion here because it's URL-driven
 * (`?year=YYYY`) and falls back to the most recent year that has invoices.
 */
test.describe('Billing page', () => {
  test('shows the current plan card highlighted and lists every plan in the registry', async ({
    page,
  }) => {
    const owner = uniqueUser('billing-current')
    await apiSignup(page.request, owner)
    await apiCreateAndActivateOrg(page.request, 'Tasca', uniqueSlug('tasca'))

    await page.goto('/dashboard/billing')

    // Both plans render — registry-driven, not hardcoded.
    await expect(page.getByTestId('plan-card-free')).toBeVisible()
    await expect(page.getByTestId('plan-card-casa')).toBeVisible()
    // Current plan is "Free"; its CTA is disabled / labeled "Current plan".
    const free = page.getByTestId('plan-card-free')
    await expect(
      free.getByRole('button', { name: 'Current plan' }),
    ).toBeDisabled()
  })

  test('empty state explains there are no invoices for the year', async ({
    page,
  }) => {
    const owner = uniqueUser('billing-empty')
    await apiSignup(page.request, owner)
    await apiCreateAndActivateOrg(page.request, 'No Bills', uniqueSlug('nobills'))

    await page.goto('/dashboard/billing')
    await expect(page.getByTestId('invoices-empty')).toBeVisible()
    await expect(page.getByTestId('invoices-table')).toHaveCount(0)
  })

  test('year filter switches between billed years and selecting a year shows only its invoices', async ({
    page,
  }) => {
    const owner = uniqueUser('billing-years')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Yearly Bistro',
      uniqueSlug('yearly'),
    )

    // Seed two invoices in 2025 and one in 2026 directly. The page reads via
    // `getInvoiceYears` which derives years from issued_at — the chips should
    // render exactly the years that have rows.
    const sql = testDb()
    await sql`
      INSERT INTO invoice (id, organization_id, plan, period_start, period_end, amount_cents, currency, status, issued_at, paid_at)
      VALUES
        (gen_random_uuid()::text, ${org.id}, 'casa', '2025-01-01', '2025-01-31', 1500, 'EUR', 'paid', '2025-02-01 10:00', '2025-02-01 10:00'),
        (gen_random_uuid()::text, ${org.id}, 'casa', '2025-06-01', '2025-06-30', 1500, 'EUR', 'paid', '2025-07-01 10:00', '2025-07-01 10:00'),
        (gen_random_uuid()::text, ${org.id}, 'casa', '2026-04-01', '2026-04-30', 1500, 'EUR', 'paid', '2026-05-01 10:00', '2026-05-01 10:00')
    `

    // Default landing — newest year (2026) is selected, one invoice rendered.
    await page.goto('/dashboard/billing')
    await expect(page.getByTestId('year-2026')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByTestId('invoice-row')).toHaveCount(1)

    // Switch to 2025 — two invoices.
    await page.getByTestId('year-2025').click()
    await expect(page).toHaveURL(/\/dashboard\/billing\?year=2025$/)
    await expect(page.getByTestId('year-2025')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByTestId('invoice-row')).toHaveCount(2)

    // A year not in the registry of issued years falls back to the newest one
    // — guards against a bookmarked URL after invoices are voided/deleted.
    await page.goto('/dashboard/billing?year=1999')
    await expect(page.getByTestId('year-2026')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByTestId('invoice-row')).toHaveCount(1)
  })
})
