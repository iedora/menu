import { expect, test } from '../../fixtures'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'
import { seedCategoryWithItems, seedMenu, testDb } from '../../helpers/db'

/**
 * `/dashboard/analytics` is the Casa-only home for the four KPI cards plus the
 * full-width scan chart. Free plans hitting the URL bounce to billing — the
 * gate is asserted here, not just at the link visibility level, because URLs
 * get bookmarked and shared.
 */

function dayOffset(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

test.describe('Casa analytics page (/dashboard/analytics)', () => {
  test('free plan is redirected to billing', async ({ page }) => {
    const owner = uniqueUser('analytics-gate')
    await apiSignup(page.request, owner)
    await apiCreateAndActivateOrg(
      page.request,
      'Free Bistro',
      uniqueSlug('free'),
    )

    await page.goto('/dashboard/analytics')
    await expect(page).toHaveURL(/\/dashboard\/billing$/)
  })

  test('renders four cards with scan rhythm, menus, dishes, and languages', async ({
    page,
  }) => {
    const owner = uniqueUser('analytics-cards')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Tasca do Avô',
      uniqueSlug('tasca'),
    )
    const sql = testDb()
    await sql`UPDATE "auth"."organization" SET plan = 'casa' WHERE id = ${org.id}`
    await sql`
      UPDATE "menu"."restaurant"
      SET supported_languages = '["en","pt","es","fr"]'::jsonb
      WHERE id = ${org.restaurantId}
    `

    await sql`DELETE FROM "menu"."menu" WHERE restaurant_id = ${org.restaurantId}`
    const lunch = await seedMenu(org.restaurantId, 'Lunch', { active: true })
    const winter = await seedMenu(org.restaurantId, 'Winter', {
      active: false,
      position: 1,
    })
    await seedCategoryWithItems(
      lunch.menuId,
      org.restaurantId,
      'Mains',
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    )
    await seedCategoryWithItems(
      winter.menuId,
      org.restaurantId,
      'Specials',
      ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
    )

    await sql`
      INSERT INTO "menu"."daily_view" (organization_id, restaurant_id, day, language, count)
      VALUES
        (${org.id}, ${org.restaurantId}, ${dayOffset(0)}, 'pt', 142),
        (${org.id}, ${org.restaurantId}, ${dayOffset(-1)}, 'pt', 230),
        (${org.id}, ${org.restaurantId}, ${dayOffset(-2)}, 'pt', 340),
        (${org.id}, ${org.restaurantId}, ${dayOffset(-3)}, 'pt', 250),
        (${org.id}, ${org.restaurantId}, ${dayOffset(-4)}, 'pt', 200),
        (${org.id}, ${org.restaurantId}, ${dayOffset(-5)}, 'pt', 140),
        (${org.id}, ${org.restaurantId}, ${dayOffset(-6)}, 'pt', 130)
    `

    await page.goto('/dashboard/analytics?range=7d')
    const block = page.getByTestId('analytics-block')
    await expect(block).toBeVisible()

    const scans = block.getByTestId('analytics-scans')
    await expect(scans).toContainText('1,432')
    await expect(scans).toContainText('142 today')
    const bars = block.getByTestId('scans-sparkline').locator('span')
    await expect(bars).toHaveCount(7)

    const menus = block.getByTestId('analytics-menus')
    await expect(menus).toContainText('2')
    await expect(menus).toContainText('1 active · 1 paused')

    const dishes = block.getByTestId('analytics-dishes')
    await expect(dishes).toContainText('14')
    await expect(dishes).toContainText(/last added/i)

    const languages = block.getByTestId('analytics-languages')
    await expect(languages).toContainText('4')
    await expect(languages).toContainText('EN · PT · ES · FR')
  })

  test('range filter swaps the scan-rhythm dataset; org-state cards stay put', async ({
    page,
  }) => {
    const owner = uniqueUser('analytics-range')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Sliding Bistro',
      uniqueSlug('slide'),
    )
    const sql = testDb()
    await sql`UPDATE "auth"."organization" SET plan = 'casa' WHERE id = ${org.id}`

    await sql`
      INSERT INTO "menu"."daily_view" (organization_id, restaurant_id, day, language, count)
      VALUES
        (${org.id}, ${org.restaurantId}, ${dayOffset(0)}, 'pt', 5),
        (${org.id}, ${org.restaurantId}, ${dayOffset(-3)}, 'pt', 10),
        (${org.id}, ${org.restaurantId}, ${dayOffset(-15)}, 'pt', 100)
    `

    await page.goto('/dashboard/analytics')
    await expect(page.getByTestId('range-30d')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByTestId('analytics-scans')).toContainText('115')

    await page.getByTestId('range-7d').click()
    await expect(page).toHaveURL(/\/dashboard\/analytics\?range=7d$/)
    await expect(page.getByTestId('analytics-scans')).toContainText('15')

    await page.getByTestId('range-today').click()
    await expect(page).toHaveURL(/\/dashboard\/analytics\?range=today$/)
    await expect(page.getByTestId('analytics-scans')).toContainText('5')
    await expect(page.getByTestId('scans-sparkline')).toHaveCount(0)

    await expect(page.getByTestId('analytics-dishes')).toContainText(/none yet|0/)
  })

  test('full-width chart renders one bar per day, hides on `today` range', async ({
    page,
  }) => {
    const owner = uniqueUser('analytics-chart')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Charty Bistro',
      uniqueSlug('chart'),
    )
    const sql = testDb()
    await sql`UPDATE "auth"."organization" SET plan = 'casa' WHERE id = ${org.id}`

    await sql`
      INSERT INTO "menu"."daily_view" (organization_id, restaurant_id, day, language, count)
      VALUES
        (${org.id}, ${org.restaurantId}, ${dayOffset(0)}, 'pt', 50),
        (${org.id}, ${org.restaurantId}, ${dayOffset(-3)}, 'pt', 200),
        (${org.id}, ${org.restaurantId}, ${dayOffset(-15)}, 'pt', 75)
    `

    await page.goto('/dashboard/analytics')
    const chart = page.getByTestId('scans-chart')
    await expect(chart).toBeVisible()
    await expect(chart.getByTestId('scans-chart-bar')).toHaveCount(30)
    await expect(chart.getByTestId('scans-chart-peak')).toContainText('peak 200')

    await page.getByTestId('range-7d').click()
    await expect(page.getByTestId('scans-chart-bar')).toHaveCount(7)

    await page.getByTestId('range-today').click()
    await expect(page.getByTestId('scans-chart')).toHaveCount(0)
  })

  test('zero state: scans is 0, sparkline shell still renders, dishes "none yet"', async ({
    page,
  }) => {
    const owner = uniqueUser('analytics-empty')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Empty Bistro',
      uniqueSlug('empty-an'),
    )
    const sql = testDb()
    await sql`UPDATE "auth"."organization" SET plan = 'casa' WHERE id = ${org.id}`

    await page.goto('/dashboard/analytics')
    const block = page.getByTestId('analytics-block')
    await expect(block).toBeVisible()
    await expect(block.getByTestId('analytics-scans')).toContainText('0')
    await expect(block.getByTestId('scans-sparkline').locator('span')).toHaveCount(
      30,
    )
    await expect(block.getByTestId('analytics-dishes')).toContainText(/none yet/i)
  })
})
