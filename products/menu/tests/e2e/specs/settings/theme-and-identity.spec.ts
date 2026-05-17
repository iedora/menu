import { expect, test } from '@playwright/test'
import { testDb } from '../../helpers/db'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'

test.describe('Settings — theme editor', () => {
  test('saves layout + colors and reflects them on the public menu', async ({
    page,
    browser,
  }) => {
    const owner = uniqueUser('theme')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Theme Bistro',
      uniqueSlug('theme'),
    )

    // Seed a category + item so the preview and public page have content.
    const sql = testDb()
    const [{ id: catId }] = await sql<{ id: string }[]>`
      INSERT INTO "menu"."category" (id, menu_id, restaurant_id, name, position, updated_at)
      VALUES (gen_random_uuid()::text, ${org.menuId}, ${org.restaurantId}, 'Mains', 0, now())
      RETURNING id
    `
    await sql`
      INSERT INTO "menu"."item" (id, category_id, restaurant_id, name, price_cents, currency, available, position, updated_at)
      VALUES (gen_random_uuid()::text, ${catId}, ${org.restaurantId}, 'Risotto', 1450, 'EUR', true, 0, now())
    `

    await page.goto(`/dashboard/r/${org.slug}/theme`)

    // Default state: classic layout, default colors.
    const preview = page.getByTestId('theme-preview')
    await expect(preview).toHaveAttribute('data-layout', 'classic')

    // Switch to minimal — preview should swap before any save.
    await page.getByTestId('layout-minimal').click()
    await expect(preview).toHaveAttribute('data-layout', 'minimal')

    // Set a non-default primary color via the hex input.
    const primaryHex = page.getByTestId('theme-primary-hex')
    await primaryHex.fill('#ff0066')

    // Save and wait for the action to settle.
    await page.getByTestId('theme-save').click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()

    // Public page picks up both changes (anonymous context — no auth bleed).
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const anonPage = await anon.newPage()
    await anonPage.goto(`/r/${org.slug}`)

    // The MenuRenderer wraps the layout in a div carrying the CSS vars inline.
    const wrapper = anonPage.locator('div[style*="--menu-primary"]').first()
    await expect(wrapper).toHaveAttribute('style', /--menu-primary:\s*#ff0066/)

    // Minimal layout uses uppercase tracking on the restaurant name; classic doesn't.
    const heading = anonPage.getByRole('heading', { name: 'Theme Bistro' })
    await expect(heading).toHaveClass(/uppercase/)

    await anon.close()
  })

  test('rejects an invalid hex color from the form', async ({ page }) => {
    const owner = uniqueUser('theme-invalid')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Invalid Bistro',
      uniqueSlug('invalid'),
    )

    await page.goto(`/dashboard/r/${org.slug}/theme`)

    const primaryHex = page.getByTestId('theme-primary-hex')
    await primaryHex.fill('not-a-color')

    // Save button stays disabled because the form gate sees the bad hex.
    await expect(page.getByTestId('theme-save')).toBeDisabled()
  })
})

test.describe('Settings — identity editor', () => {
  test('edits name + description and reflects on the public menu', async ({
    page,
    browser,
  }) => {
    const owner = uniqueUser('identity')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Original Bistro',
      uniqueSlug('identity'),
    )

    const sql = testDb()

    await page.goto(`/dashboard/r/${org.slug}/theme`)

    // Initial state: name from the seeded org. Save button starts disabled.
    await expect(page.getByTestId('identity-save')).toBeDisabled()

    await page.getByTestId('identity-name').fill('Renamed Bistro')
    await page
      .getByTestId('identity-description')
      .fill('Now serving brunch on weekends.')

    // Live preview reflects the new name immediately.
    const preview = page.getByTestId('theme-preview')
    await expect(
      preview.getByRole('heading', { name: 'Renamed Bistro' }),
    ).toBeVisible()
    await expect(
      preview.getByText('Now serving brunch on weekends.'),
    ).toBeVisible()

    await page.getByTestId('identity-save').click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()

    // Anonymous visitor sees the new name on /r/[slug].
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const anonPage = await anon.newPage()
    await anonPage.goto(`/r/${org.slug}`)
    await expect(
      anonPage.getByRole('heading', { name: 'Renamed Bistro' }),
    ).toBeVisible()
    await expect(
      anonPage.getByText('Now serving brunch on weekends.'),
    ).toBeVisible()
    await anon.close()
  })

})
