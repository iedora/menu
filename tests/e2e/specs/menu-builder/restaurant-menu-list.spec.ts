import { expect, test } from '@playwright/test'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'

test.describe('Restaurant dashboard — menu list category counts', () => {
  test('shows "No categories" for empty menu and the right plural for a seeded menu', async ({
    page,
  }) => {
    const owner = uniqueUser('menu-list')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Counts Bistro',
      uniqueSlug('counts'),
    )

    // Empty "Main menu" was created by apiCreateAndActivateOrg.
    await page.goto(`/dashboard/r/${org.slug}`)
    const mainCard = page.getByRole('link', { name: /Main menu/ })
    await expect(mainCard).toContainText('No categories')

    // Seed adds a 2nd menu with 3 categories — sample-seed-button redirects
    // into the new menu's builder.
    await page.getByTestId('seed-sample-menu').click()
    await expect(page).toHaveURL(
      new RegExp(`/dashboard/r/${org.slug}/m/[a-f0-9-]+$`),
    )

    // Back to the restaurant home — the seeded menu card must reflect the
    // real category count, not "No categories" (which was the bug when
    // postgres-js returned count(*) as a bigint string and ICU plural's #
    // substitution silently failed).
    await page.goto(`/dashboard/r/${org.slug}`)
    const sampleCard = page.getByRole('link', { name: /Sample menu/ })
    await expect(sampleCard).toContainText('3 categories')
    await expect(sampleCard).not.toContainText('No categories')

    // The empty Main menu card still says "No categories".
    await expect(mainCard).toContainText('No categories')
  })
})
