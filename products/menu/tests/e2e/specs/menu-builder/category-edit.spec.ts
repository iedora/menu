import { expect, test } from '@playwright/test'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'

// Reorder via mouse intentionally not covered here. dnd-kit's PointerSensor
// proved as flaky as the KeyboardSensor under headless Chromium (see the
// .fixme in crud.spec.ts). The reorder action itself is exercised through
// the seed + render path, and a unit-style test of arrayMove + reorderCategories
// would belong in a separate non-Playwright suite.

test.describe('Menu builder — category edit', () => {
  test('renames a category inline and persists across reload', async ({ page }) => {
    await apiSignup(page.request, uniqueUser('rename'))
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Rename Bistro',
      uniqueSlug('rename'),
    )

    await page.goto(`/dashboard/r/${org.slug}/m/${org.menuId}`)

    // Seed one category through the UI so the test exercises the live flow.
    await page.getByPlaceholder('New category name (e.g. Starters)').fill('Drinks')
    await page.getByRole('button', { name: 'Add category' }).click()
    await expect(
      page.getByRole('button', { name: 'Drinks', exact: true }),
    ).toBeVisible()

    // Click the title button → it becomes an autofocused input. Type and
    // commit by pressing Enter.
    await page.getByRole('button', { name: 'Drinks', exact: true }).click()
    const renameInput = page.locator('input').filter({ hasText: '' }).first()
    await renameInput.fill('Beverages')
    await renameInput.press('Enter')

    await expect(
      page.getByRole('button', { name: 'Beverages', exact: true }),
    ).toBeVisible()

    // After reload the new name is what the DB holds.
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'Beverages', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Drinks', exact: true }),
    ).toHaveCount(0)
  })

  test('deletes a category through the confirmation dialog', async ({ page }) => {
    await apiSignup(page.request, uniqueUser('delete-cat'))
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Delete Bistro',
      uniqueSlug('delete-cat'),
    )

    await page.goto(`/dashboard/r/${org.slug}/m/${org.menuId}`)

    // Add two categories so we can verify only the targeted one is removed.
    for (const name of ['Keep', 'Drop']) {
      await page.getByPlaceholder('New category name (e.g. Starters)').fill(name)
      await page.getByRole('button', { name: 'Add category' }).click()
      await expect(
        page.getByRole('button', { name, exact: true }),
      ).toBeVisible()
    }

    // The Delete button has aria-label "Delete <name>" — uniquely identifies
    // each category's delete action.
    await page.getByRole('button', { name: 'Delete Drop' }).click()

    // Confirmation dialog: title + destructive Delete button.
    await expect(page.getByRole('heading', { name: 'Delete Drop?' })).toBeVisible()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete', exact: true })
      .click()

    // Drop is gone, Keep stays.
    await expect(page.getByRole('button', { name: 'Drop', exact: true })).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Keep', exact: true }),
    ).toBeVisible()

    // Persists across reload.
    await page.reload()
    await expect(page.getByRole('button', { name: 'Drop', exact: true })).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Keep', exact: true }),
    ).toBeVisible()
  })
})
