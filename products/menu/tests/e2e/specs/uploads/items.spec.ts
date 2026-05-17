import { expect, test } from '@playwright/test'
import { testDb } from '../../helpers/db'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64',
)

test.describe('Uploads — item photos', () => {
  test('uploads a photo from the item dialog and renders it on the public menu', async ({
    page,
    browser,
  }) => {
    const owner = uniqueUser('item-photo')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Photo Bistro',
      uniqueSlug('photo'),
    )

    const sql = testDb()
    const [{ id: catId }] = await sql<{ id: string }[]>`
      INSERT INTO "menu"."category" (id, menu_id, restaurant_id, name, position, updated_at)
      VALUES (gen_random_uuid()::text, ${org.menuId}, ${org.restaurantId}, 'Mains', 0, now())
      RETURNING id
    `
    const [{ id: itemId }] = await sql<{ id: string }[]>`
      INSERT INTO "menu"."item" (id, category_id, restaurant_id, name, price_cents, currency, available, position, updated_at)
      VALUES (gen_random_uuid()::text, ${catId}, ${org.restaurantId}, 'Risotto', 1450, 'EUR', true, 0, now())
      RETURNING id
    `

    await page.goto(`/dashboard/r/${org.slug}/m/${org.menuId}`)

    // Open the item edit dialog by clicking the row.
    await page.getByRole('button', { name: /Risotto/ }).click()

    await page
      .getByTestId('upload-item-photo-input')
      .setInputFiles({
        name: 'photo.png',
        mimeType: 'image/png',
        buffer: TINY_PNG,
      })

    const dialogPreview = page.getByTestId('upload-item-photo-preview')
    await expect(dialogPreview).toBeVisible({ timeout: 20_000 })
    await expect(dialogPreview).toHaveAttribute(
      'src',
      new RegExp(
        `/metamenu-test/r/${org.restaurantId}/items/${itemId}/.+\\.png$`,
      ),
    )

    // DB now carries the URL on the item row, scoped to this restaurant.
    const rows = await sql<{ imageUrl: string | null }[]>`
      SELECT image_url AS "imageUrl" FROM "menu"."item" WHERE id = ${itemId}
    `
    expect(rows[0]?.imageUrl).toMatch(
      new RegExp(`^http://localhost:4566/metamenu-test/r/${org.restaurantId}/items/${itemId}/`),
    )

    // Close the dialog and confirm the row thumbnail shows up.
    await page.keyboard.press('Escape')
    await expect(page.getByTestId(`item-thumb-${itemId}`)).toBeVisible()

    // Anonymous visitor sees the photo on /r/[slug] (classic template).
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const anonPage = await anon.newPage()
    await anonPage.goto(`/r/${org.slug}`)
    const photo = anonPage.locator(
      `img[src*="/r/${org.restaurantId}/items/${itemId}/"]`,
    )
    await expect(photo).toBeVisible()
    await anon.close()
  })

  test('rejects an oversize item photo via client-side validation', async ({
    page,
  }) => {
    const owner = uniqueUser('item-large')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Big Photo Bistro',
      uniqueSlug('big-photo'),
    )

    const sql = testDb()
    const [{ id: catId }] = await sql<{ id: string }[]>`
      INSERT INTO "menu"."category" (id, menu_id, restaurant_id, name, position, updated_at)
      VALUES (gen_random_uuid()::text, ${org.menuId}, ${org.restaurantId}, 'Mains', 0, now())
      RETURNING id
    `
    await sql`
      INSERT INTO "menu"."item" (id, category_id, restaurant_id, name, price_cents, currency, available, position, updated_at)
      VALUES (gen_random_uuid()::text, ${catId}, ${org.restaurantId}, 'Big Item', 100, 'EUR', true, 0, now())
    `

    await page.goto(`/dashboard/r/${org.slug}/m/${org.menuId}`)
    await page.getByRole('button', { name: /Big Item/ }).click()

    // 4 MB > 3 MB item-photo limit.
    const tooBig = Buffer.alloc(4 * 1024 * 1024, 0)
    await page
      .getByTestId('upload-item-photo-input')
      .setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: tooBig })

    await expect(page.getByTestId('upload-item-photo-error')).toContainText(
      /too large/i,
    )
  })
})
