import { expect, test } from '@playwright/test'
import { testDb } from '../../helpers/db'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'

test.describe('Menu builder — sample seed', () => {
  test('seeds a menu with categories and items, lands in the builder', async ({
    page,
  }) => {
    const owner = uniqueUser('seed')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Seed Bistro',
      uniqueSlug('seed'),
    )

    await page.goto(`/dashboard/r/${org.slug}`)
    await page.getByTestId('seed-sample-menu').click()

    // Action redirects into the new menu's builder.
    await expect(page).toHaveURL(
      new RegExp(`/dashboard/r/${org.slug}/m/[a-f0-9-]+$`),
    )

    // Three categories from the seed data show up. `exact: true` avoids the
    // adjacent "Delete Starters" button that shares the category name.
    await expect(
      page.getByRole('button', { name: 'Starters', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Mains', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Desserts', exact: true }),
    ).toBeVisible()

    // Spot-check a couple of items that should be present.
    await expect(page.getByText('Bruschetta')).toBeVisible()
    await expect(page.getByText('Steak frites')).toBeVisible()
    await expect(page.getByText('Tiramisu')).toBeVisible()

    // apiCreateAndActivateOrg already inserted a "Main menu", so after the
    // seed there are 2 menus. Categories and items belong only to the seed.
    const sql = testDb()
    const counts = await sql<
      { menus: number; categories: number; items: number }[]
    >`
      SELECT
        (SELECT COUNT(*)::int FROM menu WHERE restaurant_id = ${org.restaurantId}) AS menus,
        (SELECT COUNT(*)::int FROM category WHERE restaurant_id = ${org.restaurantId}) AS categories,
        (SELECT COUNT(*)::int FROM item WHERE restaurant_id = ${org.restaurantId}) AS items
    `
    expect(counts[0]).toEqual({ menus: 2, categories: 3, items: 8 })
  })

  test('seeded menu renders on the public page', async ({
    page,
    browser,
  }) => {
    const owner = uniqueUser('seed-public')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Public Seed Bistro',
      uniqueSlug('seed-pub'),
    )

    await page.goto(`/dashboard/r/${org.slug}`)
    await page.getByTestId('seed-sample-menu').click()
    await expect(page).toHaveURL(
      new RegExp(`/dashboard/r/${org.slug}/m/[a-f0-9-]+$`),
    )

    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const anonPage = await anon.newPage()
    await anonPage.goto(`/r/${org.slug}`)
    await expect(
      anonPage.getByRole('heading', { name: 'Starters' }),
    ).toBeVisible()
    await expect(anonPage.getByText('Spaghetti Carbonara')).toBeVisible()
    await expect(anonPage.getByText('€14.00')).toBeVisible()
    await anon.close()
  })
})
