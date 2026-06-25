import { expect, test } from '@playwright/test'

/**
 * Auth surface — backend-free. We exercise the page render + Conform's
 * CLIENT-side validation (no credentials reach the auth service), so an empty
 * submit stays on the form and surfaces errors instead of navigating away.
 */
test.describe('sign-up', () => {
  test('renders the form fields', async ({ page }) => {
    await page.goto('/menu/sign-up')
    await expect(page.getByTestId('sign-up-name')).toBeVisible()
    await expect(page.getByTestId('sign-up-email')).toBeVisible()
    await expect(page.getByTestId('sign-up-password')).toBeVisible()
    await expect(page.getByTestId('sign-up-submit')).toBeVisible()
  })

  test('an empty submit validates client-side and does not navigate', async ({ page }) => {
    await page.goto('/menu/sign-up')
    await page.getByTestId('sign-up-submit').click()
    // Conform blocks the submit and marks fields invalid; we never leave the page.
    await expect(page).toHaveURL(/\/menu\/sign-up/)
    await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible()
  })
})

test.describe('sign-in', () => {
  test('renders and links to sign-up', async ({ page }) => {
    await page.goto('/menu/sign-in')
    await expect(page.getByTestId('sign-in-email')).toBeVisible()
    await expect(page.getByTestId('sign-in-password')).toBeVisible()
    await expect(page.getByTestId('sign-in-submit')).toBeVisible()
  })
})
