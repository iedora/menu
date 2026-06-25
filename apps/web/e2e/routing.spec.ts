import { expect, test } from '@playwright/test'

/**
 * Routing + guards — resolved by the proxy middleware and RSCs without a backend
 * call (no session cookie → null session → redirect; unknown route → not-found).
 */
test('the dashboard redirects unauthenticated visitors to sign-in', async ({ page }) => {
  await page.goto('/menu/dashboard')
  await expect(page).toHaveURL(/sign-in/)
  await expect(page.getByTestId('sign-in-submit')).toBeVisible()
})

test('an unknown route renders the custom 404', async ({ page }) => {
  const res = await page.goto('/menu/does-not-exist-' + Date.now())
  expect(res?.status()).toBe(404)
  await expect(page.getByText('404')).toBeVisible()
})
