import { expect, test } from '@playwright/test'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'
import { seedCategoryWithItems, seedMenu, testDb } from '../../helpers/db'

test.describe('Restaurant dashboard — menu list', () => {
  test('shows "No categories · No dishes" for empty menu and the right plural after seeding', async ({
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

    const mainRow = page
      .getByTestId('editorial-row')
      .filter({ hasText: 'Main menu' })
    await expect(mainRow).toBeVisible()
    await expect(mainRow).toContainText('No categories')
    await expect(mainRow).toContainText('No dishes')

    // Seed adds a 2nd menu with 3 categories and 8 items — the sample-seed
    // button redirects into the new menu's builder.
    await page.getByTestId('seed-sample-menu').click()
    await expect(page).toHaveURL(
      new RegExp(`/dashboard/r/${org.slug}/m/[a-f0-9-]+$`),
    )

    // Back to the restaurant home — both menus' counts must match reality.
    // This is the regression case for the bigint-string ICU bug we hit:
    // a populated menu rendering "No categories".
    await page.goto(`/dashboard/r/${org.slug}`)
    const sampleRow = page
      .getByTestId('editorial-row')
      .filter({ hasText: 'Sample menu' })
    await expect(sampleRow).toContainText('3 categories · 8 dishes')
    await expect(sampleRow).not.toContainText('No categories')

    await expect(mainRow).toContainText('No categories · No dishes')
  })

  test('singular plurals render correctly with one category and one dish', async ({
    page,
  }) => {
    const owner = uniqueUser('menu-singular')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Singular Bistro',
      uniqueSlug('singular'),
    )

    // Replace the auto-created Main menu with a fresh one carrying exactly
    // one category and one dish, to lock the singular branch of both ICU
    // plurals in the same test.
    const sql = testDb()
    await sql`DELETE FROM menu WHERE restaurant_id = ${org.restaurantId}`
    const { menuId } = await seedMenu(org.restaurantId, 'Tasting')
    await seedCategoryWithItems(menuId, org.restaurantId, 'Today', ['Soup'])

    await page.goto(`/dashboard/r/${org.slug}`)
    const row = page.getByTestId('editorial-row').filter({ hasText: 'Tasting' })
    await expect(row).toContainText('1 category · 1 dish')
  })

  test('inactive menus surface a "disabled" status in the row', async ({
    page,
  }) => {
    const owner = uniqueUser('menu-inactive')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Inactive Bistro',
      uniqueSlug('inactive'),
    )

    // Flip the auto-created menu to inactive directly.
    const sql = testDb()
    await sql`UPDATE menu SET active = false WHERE restaurant_id = ${org.restaurantId}`

    await page.goto(`/dashboard/r/${org.slug}`)
    const row = page
      .getByTestId('editorial-row')
      .filter({ hasText: 'Main menu' })
    await expect(row.getByText('disabled', { exact: true })).toBeVisible()
  })

  test('clicking a menu row navigates into the builder', async ({ page }) => {
    const owner = uniqueUser('menu-click')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Click Bistro',
      uniqueSlug('menu-click'),
    )

    await page.goto(`/dashboard/r/${org.slug}`)
    await page.getByRole('link', { name: 'Main menu', exact: true }).click()
    await expect(page).toHaveURL(
      new RegExp(`/dashboard/r/${org.slug}/m/[a-f0-9-]+$`),
    )
  })
})
