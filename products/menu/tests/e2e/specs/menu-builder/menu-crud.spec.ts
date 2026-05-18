import { expect, test } from '../../fixtures'
import { seedRestaurant, testDb } from '../../helpers/db'

test.describe('Menu builder — menu CRUD', () => {
  test('create and delete a menu — persists in DB', async ({
    signInNewUser,
    seedOrg,
  }) => {
    const { context, page, user } = await signInNewUser('menu-crud')
    const org = await seedOrg({
      name: 'Menu CRUD Bistro',
      slug: `menu-crud-${Date.now().toString(36)}`,
      ownerId: user.userId,
    })
    const { restaurantId } = await seedRestaurant(
      org.id,
      'Menu CRUD Bistro',
      org.slug,
    )

    await page.goto(`/dashboard/r/${org.slug}`)

    // Create: rendered by CreateMenuDialog (variant="solid" Button labelled
    // by `Restaurant.newMenu`).
    await page.getByRole('button', { name: 'New menu' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel(/name/i).fill('Lunch menu')
    // The dialog footer uses the shared "Save" label from Common.save.
    await dialog.getByRole('button', { name: /^(Save|Saving…?)$/i }).click()
    await expect(dialog).toBeHidden()

    await expect(page.getByText('Lunch menu')).toBeVisible()

    const sql = testDb()
    const created = await sql<{ id: string; name: string }[]>`
      SELECT id, name FROM "menu"."menu"
      WHERE restaurant_id = ${restaurantId} AND name = 'Lunch menu'
    `
    expect(created.length).toBe(1)

    // Delete: DeleteMenuButton renders a row-level button with
    // `aria-label="Delete <menuName>"`; the confirm dialog has its own
    // "Delete" button (variant="accent").
    await page.getByRole('button', { name: 'Delete Lunch menu' }).click()
    const confirm = page.getByRole('dialog')
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: /^(Delete|Deleting…?)$/ }).click()
    await expect(confirm).toBeHidden()

    await expect(page.getByText('Lunch menu')).toHaveCount(0)

    const remaining = await sql<{ id: string }[]>`
      SELECT id FROM "menu"."menu"
      WHERE restaurant_id = ${restaurantId} AND name = 'Lunch menu'
    `
    expect(remaining.length).toBe(0)

    await context.close()
  })
})
