import { expect, test } from '../../fixtures'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'
import {
  seedCategoryWithItems,
  seedMenu,
  seedRestaurant,
  testDb,
} from '../../helpers/db'

/**
 * Coverage matrix for the /dashboard editorial list:
 *
 *  - one restaurant, no menus, no dishes  → "No menus · No dishes"
 *  - one restaurant, 1 menu, 8 dishes     → "1 menu · 8 dishes"
 *  - two restaurants                      → both rows render in createdAt order
 *  - clicking the title link              → /dashboard/r/{slug}
 *  - clicking each action chip            → corresponding sub-page
 *  - keyboard tab order                   → title → menus chip → theme chip
 *                                            → QR chip → next row's title
 *
 * The plural assertions are the regression guard for the bigint-string ICU
 * bug we hit recently — locking the *rendered* string is what would have
 * caught it.
 */

test.describe('Dashboard — editorial list', () => {
  test('one restaurant with no menus shows zero-count copy', async ({ page }) => {
    const owner = uniqueUser('dash-empty')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Empty Bistro',
      uniqueSlug('empty'),
    )

    // apiCreateAndActivateOrg auto-inserts a "Main menu" — drop it so the
    // restaurant has zero menus and zero dishes.
    const sql = testDb()
    await sql`DELETE FROM menu WHERE restaurant_id = ${org.restaurantId}`

    await page.goto('/dashboard')

    const list = page.getByTestId('restaurant-list')
    await expect(list).toBeVisible()

    const row = list.getByTestId('editorial-row')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Empty Bistro')
    await expect(row).toContainText('No menus')
    await expect(row).toContainText('No dishes')
  })

  test('seeded restaurant shows correct singular/plural counts', async ({ page }) => {
    const owner = uniqueUser('dash-seeded')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Seeded Bistro',
      uniqueSlug('seeded'),
    )

    // Clear the auto-created "Main menu" and seed one menu with three items.
    const sql = testDb()
    await sql`DELETE FROM menu WHERE restaurant_id = ${org.restaurantId}`
    const { menuId } = await seedMenu(org.restaurantId, 'Lunch')
    await seedCategoryWithItems(menuId, org.restaurantId, 'Starters', [
      'Bread',
      'Olives',
      'Soup',
    ])

    await page.goto('/dashboard')

    const row = page.getByTestId('editorial-row').first()
    // Lock the exact rendered plural strings — these are what regress when
    // the ICU formatter receives a bigint string.
    await expect(row).toContainText('1 menu · 3 dishes')
  })

  test('multiple restaurants render in createdAt order', async ({ page }) => {
    const owner = uniqueUser('dash-many')
    await apiSignup(page.request, owner)
    const first = await apiCreateAndActivateOrg(
      page.request,
      'Tasca do Avô',
      uniqueSlug('tasca'),
    )

    // Second restaurant directly inserted under the same org.
    await seedRestaurant(first.id, 'Café Lumière', uniqueSlug('cafe'))

    await page.goto('/dashboard')

    const rows = page.getByTestId('editorial-row')
    await expect(rows).toHaveCount(2)

    const tasca = rows.first()
    const cafe = rows.nth(1)
    await expect(tasca).toContainText('Tasca do Avô')
    await expect(cafe).toContainText('Café Lumière')
  })

  test('clicking the title navigates to the restaurant page', async ({ page }) => {
    const owner = uniqueUser('dash-nav')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Click Bistro',
      uniqueSlug('click'),
    )

    await page.goto('/dashboard')
    // The title link wraps title + subtitle inside one <Link>, so the
    // accessible name is the full concatenation. Scope by row + first link.
    const row = page
      .getByTestId('editorial-row')
      .filter({ hasText: 'Click Bistro' })
    await row.getByRole('link').first().click()
    await expect(page).toHaveURL(new RegExp(`/dashboard/r/${org.slug}$`))
  })

  test('clicking each action chip lands on its sub-page', async ({ page }) => {
    const owner = uniqueUser('dash-chips')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Chip Bistro',
      uniqueSlug('chip'),
    )

    await page.goto('/dashboard')

    // The chip's accessible name is its label, but the title link could
    // potentially also be matched — scope to the editorial row first to
    // avoid ambiguity.
    const row = page.getByTestId('editorial-row')
    await row.getByRole('link', { name: 'theme', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/dashboard/r/${org.slug}/theme$`))

    await page.goto('/dashboard')
    await row.getByRole('link', { name: 'QR', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/dashboard/r/${org.slug}/qr$`))
  })

  test('keyboard nav moves through title and chips in reading order', async ({
    page,
  }) => {
    const owner = uniqueUser('dash-kbd')
    await apiSignup(page.request, owner)
    await apiCreateAndActivateOrg(page.request, 'Kbd Bistro', uniqueSlug('kbd'))

    await page.goto('/dashboard')

    // Focus the title link first explicitly, then tab through and assert
    // each landing element is one of the row's interactive controls in the
    // expected order. The title link wraps title + subtitle so we scope to
    // the row and pick the first link rather than relying on accessible name.
    const row = page
      .getByTestId('editorial-row')
      .filter({ hasText: 'Kbd Bistro' })
    const title = row.getByRole('link').first()
    await title.focus()
    await expect(title).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(
      page.getByTestId('editorial-row').getByRole('link', { name: 'menus', exact: true }),
    ).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(
      page.getByTestId('editorial-row').getByRole('link', { name: 'theme', exact: true }),
    ).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(
      page.getByTestId('editorial-row').getByRole('link', { name: 'QR', exact: true }),
    ).toBeFocused()
  })
})
