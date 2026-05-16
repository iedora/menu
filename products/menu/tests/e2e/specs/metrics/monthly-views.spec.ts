import { expect, test } from '../../fixtures'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'
import { testDb } from '../../helpers/db'

/**
 * View tracking moved off the page render into an `/api/track/[slug]` pixel
 * beacon. The beacon dedupes by `(visitor, restaurant, hour)`, so:
 *  - 3 F5s from the same browser context = 1 counted view (cookie-tracked).
 *  - 3 visits from 3 fresh contexts = 3 counted views.
 * The dashboard meter sums the same `daily_view` rows it always did.
 */

function todayString(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

test.describe('Monthly views meter', () => {
  test('dedup: repeated F5s from one visitor in the same hour count as one view', async ({
    page,
    browser,
  }) => {
    const owner = uniqueUser('views-dedup')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Dedup Bistro',
      uniqueSlug('dedup'),
    )

    const anon = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const anonPage = await anon.newPage()
    await anonPage.goto(`/r/${org.slug}`)
    await anonPage.goto(`/r/${org.slug}`)
    await anonPage.goto(`/r/${org.slug}`)
    await anon.close()

    const sql = testDb()
    const day = todayString()
    await expect
      .poll(
        async () => {
          const rows = await sql<{ total: number }[]>`
            SELECT COALESCE(SUM(count), 0)::int AS total
            FROM daily_view
            WHERE restaurant_id = ${org.restaurantId} AND day = ${day}
          `
          return rows[0]?.total ?? 0
        },
        { timeout: 5_000 },
      )
      .toBe(1)
  })

  test('three fresh visitors count as three views', async ({
    page,
    browser,
  }) => {
    const owner = uniqueUser('views-fresh')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Fresh Bistro',
      uniqueSlug('fresh'),
    )

    for (let i = 0; i < 3; i++) {
      const anon = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      })
      const anonPage = await anon.newPage()
      await anonPage.goto(`/r/${org.slug}`)
      await anon.close()
    }

    const sql = testDb()
    const day = todayString()
    await expect
      .poll(
        async () => {
          const rows = await sql<{ total: number }[]>`
            SELECT COALESCE(SUM(count), 0)::int AS total
            FROM daily_view
            WHERE restaurant_id = ${org.restaurantId} AND day = ${day}
          `
          return rows[0]?.total ?? 0
        },
        { timeout: 5_000 },
      )
      .toBe(3)
  })

  test('bot user-agents are ignored', async ({ page, browser }) => {
    const owner = uniqueUser('views-bot')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Bot Bistro',
      uniqueSlug('bot'),
    )

    const botCtx = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      storageState: { cookies: [], origins: [] },
    })
    const botPage = await botCtx.newPage()
    await botPage.goto(`/r/${org.slug}`)
    await botCtx.close()

    // Give the beacon a moment to NOT increment.
    await new Promise((r) => setTimeout(r, 500))
    const sql = testDb()
    const day = todayString()
    const rows = await sql<{ total: number }[]>`
      SELECT COALESCE(SUM(count), 0)::int AS total
      FROM daily_view
      WHERE restaurant_id = ${org.restaurantId} AND day = ${day}
    `
    expect(rows[0]?.total ?? 0).toBe(0)
  })

  test('free plan: meter shows count and nudges past 80% of the monthly limit', async ({
    page,
  }) => {
    const owner = uniqueUser('views-meter')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Nudge Bistro',
      uniqueSlug('nudge'),
    )

    const sql = testDb()
    const day = todayString()

    await sql`
      INSERT INTO daily_view (organization_id, restaurant_id, day, language, count)
      VALUES (${org.id}, ${org.restaurantId}, ${day}, 'en', 200)
    `
    await page.goto('/dashboard')
    const meter = page.getByTestId('views-meter')
    await expect(meter).toContainText('200 / 1,000')
    await expect(meter).toHaveAttribute('data-near-limit', 'false')
    await expect(page.getByTestId('views-upgrade-nudge')).toHaveCount(0)

    await sql`
      UPDATE daily_view SET count = 850
      WHERE restaurant_id = ${org.restaurantId} AND day = ${day} AND language = 'en'
    `
    await page.reload()
    await expect(page.getByTestId('views-meter')).toHaveAttribute(
      'data-near-limit',
      'true',
    )
    const nudge = page.getByTestId('views-upgrade-nudge')
    await expect(nudge).toBeVisible()
    await expect(nudge).toHaveAttribute('href', '/dashboard/billing')
  })

  test('Casa plan: meter still renders on /dashboard, analytics page is one click away', async ({
    page,
  }) => {
    const owner = uniqueUser('views-casa')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Casa Views',
      uniqueSlug('casa-views'),
    )

    const sql = testDb()
    await sql`UPDATE organization SET plan = 'casa' WHERE id = ${org.id}`

    await page.goto('/dashboard')
    const meter = page.getByTestId('views-meter')
    await expect(meter).toBeVisible()
    await expect(meter).not.toContainText('/ ')
    await expect(meter).toHaveAttribute('data-near-limit', 'false')
    await expect(page.getByTestId('views-upgrade-nudge')).toHaveCount(0)
    await expect(page.getByTestId('analytics-block')).toHaveCount(0)

    await page.getByTestId('nav-analytics').click()
    await expect(page).toHaveURL(/\/dashboard\/analytics$/)
    await expect(page.getByTestId('analytics-block')).toBeVisible()
  })
})
