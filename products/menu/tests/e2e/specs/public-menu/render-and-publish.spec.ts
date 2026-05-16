import { expect, test } from '@playwright/test'
import { testDb } from '../../helpers/db'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'

// Public page is unauthenticated. Each test forces a clean storageState so a
// stray cookie from a previous case can't change behavior.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Public menu page (/r/[slug])', () => {
  test('returns 404 when the slug does not exist', async ({ page }) => {
    const res = await page.goto('/r/nonexistent-slug-xyz-123', {
      waitUntil: 'commit',
    })
    expect(res?.status()).toBe(404)
  })

  test('renders categories and items for a restaurant', async ({
    page,
    request,
  }) => {
    const owner = uniqueUser('public-render')
    await apiSignup(request, owner)
    const org = await apiCreateAndActivateOrg(
      request,
      'Public Bistro',
      uniqueSlug('public'),
    )

    const sql = testDb()
    const [{ id: catId }] = await sql<{ id: string }[]>`
      INSERT INTO category (id, menu_id, restaurant_id, name, position, updated_at)
      VALUES (gen_random_uuid()::text, ${org.menuId}, ${org.restaurantId}, 'Mains', 0, now())
      RETURNING id
    `
    await sql`
      INSERT INTO item (id, category_id, restaurant_id, name, description, price_cents, currency, available, position, updated_at)
      VALUES
        (gen_random_uuid()::text, ${catId}, ${org.restaurantId}, 'Steak frites', 'House cut, peppercorn jus', 1850, 'EUR', true, 0, now()),
        (gen_random_uuid()::text, ${catId}, ${org.restaurantId}, 'Risotto', null, 1450, 'EUR', false, 1, now())
    `

    const res = await page.goto(`/r/${org.slug}`)
    expect(res?.status()).toBe(200)

    await expect(page.getByRole('heading', { name: 'Public Bistro' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mains' })).toBeVisible()
    await expect(page.getByText('Steak frites')).toBeVisible()
    await expect(page.getByText('House cut, peppercorn jus')).toBeVisible()
    await expect(page.getByText('€18.50')).toBeVisible()

    // Sold-out item still appears, but is marked as such
    await expect(page.getByText('Risotto')).toBeVisible()
    await expect(page.getByText('Sold out')).toBeVisible()
    await expect(page.getByText('€14.50')).toBeVisible()
  })

  test('admin email and org-only data are not exposed to anonymous visitors', async ({
    page,
    request,
  }) => {
    const owner = uniqueUser('isolation')
    await apiSignup(request, owner)
    const org = await apiCreateAndActivateOrg(
      request,
      'Isolation Bistro',
      uniqueSlug('iso'),
    )

    const html = await (await page.goto(`/r/${org.slug}`))!.text()
    expect(html).not.toContain(owner.email)
    expect(html).not.toContain('/dashboard')
  })
})
