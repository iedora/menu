import { expect, test } from '../../fixtures'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'
import { testDb } from '../../helpers/db'

/**
 * Plan limit gates the `+ new restaurant` flow.
 *
 *  - Free plan (default): 1 restaurant. Dashboard CTA flips to "Upgrade",
 *    onboarding action returns an error if a second one is attempted.
 *  - Casa plan: no limit. The CTA stays on "+ new restaurant" and a second
 *    onboarding succeeds against the SAME organization (refactor confirms the
 *    second restaurant lives under the existing org, not a new one).
 *
 * Plan upgrades go through the placeholder action (no payment yet) — switching
 * the org's plan via DB is equivalent and keeps the spec hermetic.
 */
test.describe('Plans — restaurant limit', () => {
  test('free plan caps the dashboard at one restaurant and surfaces the upgrade CTA', async ({
    page,
  }) => {
    const owner = uniqueUser('plan-free')
    await apiSignup(page.request, owner)
    await apiCreateAndActivateOrg(
      page.request,
      'Casa do Avô',
      uniqueSlug('avo'),
    )

    await page.goto('/dashboard')

    // CTA points at the upgrade flow, not at /onboarding.
    const upgrade = page.getByTestId('upgrade-cta')
    await expect(upgrade).toBeVisible()
    await expect(upgrade).toHaveAttribute('href', '/dashboard/billing')

    // The "+ new restaurant" link is replaced — assert it's gone.
    await expect(
      page.getByRole('link', { name: /\+ new restaurant/i }),
    ).toHaveCount(0)
  })

  test('upgrading to Casa unlocks the new-restaurant CTA and a second onboarding succeeds', async ({
    page,
  }) => {
    const owner = uniqueUser('plan-casa')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Tasca Lumière',
      uniqueSlug('lumiere'),
    )

    // Flip to Casa via DB — the upgrade page does the same write through the
    // placeholder action; the spec stays focused on the gate behaviour.
    const sql = testDb()
    await sql`UPDATE "auth"."organization" SET plan = 'casa' WHERE id = ${org.id}`

    await page.goto('/dashboard')
    await expect(page.getByTestId('upgrade-cta')).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: /\+ new restaurant/i }),
    ).toBeVisible()

    // Second onboarding adds to the SAME org (gate passes, no new org created).
    await page.goto('/onboarding')
    const secondSlug = uniqueSlug('petisco')
    await page.getByLabel('Restaurant name').fill('Petisco do Mar')
    await page.getByLabel('URL slug').fill(secondSlug)
    await page.getByRole('button', { name: 'Create restaurant' }).click()
    await page.waitForURL('**/dashboard')

    // Both restaurants render under one org → 2 rows in the editorial list.
    await expect(page.getByTestId('editorial-row')).toHaveCount(2)
    await expect(page.getByText('Tasca Lumière')).toBeVisible()
    await expect(page.getByText('Petisco do Mar')).toBeVisible()

    // DB confirms both rows share the org id from the first onboarding.
    const counts = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM "menu"."restaurant" WHERE organization_id = ${org.id}
    `
    expect(counts[0].n).toBe(2)
  })
})
