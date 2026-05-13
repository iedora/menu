import { expect, test } from '@playwright/test'
import { testDb } from '../../helpers/db'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'

// 1×1 transparent PNG — minimal valid payload for an image upload test.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64',
)

// TODO: re-enable once LocalStack-based S3 in CI is debugged. The presigned
// PUT and/or public-read policy behaves differently from MinIO, and the
// preview img never appears within 20s. Tests pass locally against MinIO.
test.describe.skip('Uploads — restaurant logo', () => {
  test('uploads a logo, persists URL, and renders on the public menu', async ({
    page,
    browser,
  }) => {
    const owner = uniqueUser('upload')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Upload Bistro',
      uniqueSlug('upload'),
    )
    const sql = testDb()
    await page.goto(`/dashboard/r/${org.slug}/theme`)

    await page
      .getByTestId('upload-restaurant-logo-input')
      .setInputFiles({
        name: 'logo.png',
        mimeType: 'image/png',
        buffer: TINY_PNG,
      })

    // First upload may pay the bucket-bootstrap cost; allow extra time.
    const preview = page.getByTestId('upload-restaurant-logo-preview')
    await expect(preview).toBeVisible({ timeout: 20_000 })
    await expect(preview).toHaveAttribute(
      'src',
      new RegExp(`/metamenu-test/r/${org.restaurantId}/logo-.*\\.png$`),
    )

    // DB column is now populated and points at MinIO.
    const rows = await sql<{ logoUrl: string | null }[]>`
      SELECT logo_url AS "logoUrl" FROM restaurant WHERE id = ${org.restaurantId}
    `
    expect(rows[0]?.logoUrl).toMatch(
      new RegExp(`^http://localhost:9000/metamenu-test/r/${org.restaurantId}/logo-`),
    )

    // Public visitor sees the logo image.
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const anonPage = await anon.newPage()
    await anonPage.goto(`/r/${org.slug}`)
    await expect(
      anonPage.getByRole('img', { name: 'Upload Bistro logo' }),
    ).toBeVisible()
    await anon.close()
  })

  test('replacing a logo deletes the previous object', async ({ page }) => {
    const owner = uniqueUser('upload-replace')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Replace Bistro',
      uniqueSlug('replace'),
    )

    await page.goto(`/dashboard/r/${org.slug}/theme`)

    // First upload.
    await page
      .getByTestId('upload-restaurant-logo-input')
      .setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: TINY_PNG })
    const preview = page.getByTestId('upload-restaurant-logo-preview')
    await expect(preview).toBeVisible({ timeout: 20_000 })
    const firstUrl = await preview.getAttribute('src')
    expect(firstUrl).toBeTruthy()

    // Second upload — same component, different file. New URL, old key gone.
    await page
      .getByTestId('upload-restaurant-logo-input')
      .setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: TINY_PNG })

    await expect
      .poll(async () => preview.getAttribute('src'), { timeout: 15_000 })
      .not.toBe(firstUrl)

    // Old object is unreachable on the public bucket.
    const oldRes = await page.request.get(firstUrl!)
    expect(oldRes.status()).toBe(404)
  })

  test('Remove clears the URL in DB and 404s the underlying object', async ({
    page,
  }) => {
    const owner = uniqueUser('upload-remove')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Remove Bistro',
      uniqueSlug('remove'),
    )

    await page.goto(`/dashboard/r/${org.slug}/theme`)

    // Seed via the same UI flow — keeps the test honest about the live path.
    await page
      .getByTestId('upload-restaurant-logo-input')
      .setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: TINY_PNG })
    const preview = page.getByTestId('upload-restaurant-logo-preview')
    await expect(preview).toBeVisible({ timeout: 20_000 })
    const url = await preview.getAttribute('src')
    expect(url).toBeTruthy()

    await page.getByTestId('upload-restaurant-logo-remove').click()

    // Preview disappears (returns to the dashed placeholder).
    await expect(preview).toHaveCount(0)

    // DB column cleared.
    const sql = testDb()
    const rows = await sql<{ logoUrl: string | null }[]>`
      SELECT logo_url AS "logoUrl" FROM restaurant WHERE id = ${org.restaurantId}
    `
    expect(rows[0]?.logoUrl).toBeNull()

    // Object is no longer reachable.
    const res = await page.request.get(url!)
    expect(res.status()).toBe(404)
  })

  test('rejects an oversize upload via client-side validation', async ({ page }) => {
    const owner = uniqueUser('upload-large')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Big Bistro',
      uniqueSlug('big'),
    )

    await page.goto(`/dashboard/r/${org.slug}/theme`)

    // 3 MB > 2 MB logo limit. Buffer of zeros is enough — we reject before PUT.
    const tooBig = Buffer.alloc(3 * 1024 * 1024, 0)
    await page
      .getByTestId('upload-restaurant-logo-input')
      .setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: tooBig })

    await expect(page.getByTestId('upload-restaurant-logo-error')).toContainText(
      /too large/i,
    )
  })
})
