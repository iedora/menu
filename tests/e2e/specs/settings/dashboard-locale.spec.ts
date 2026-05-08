import { expect, test } from '@playwright/test'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'

test.describe('Dashboard UI locale (next-intl)', () => {
  test('switching the locale switcher swaps strings + html lang', async ({
    page,
  }) => {
    const owner = uniqueUser('locale')
    await apiSignup(page.request, owner)
    await apiCreateAndActivateOrg(
      page.request,
      'Locale Bistro',
      uniqueSlug('locale'),
    )

    await page.goto('/dashboard')

    // The h1 ("A carta da casa.") is a brand phrase shared across locales.
    // Use the eyebrow + subtitle to assert the catalog actually swapped, since
    // those *are* localized.
    await expect(page.getByText('your places', { exact: true })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    // Switch UI to Portuguese via the header switcher.
    await page.getByTestId('user-locale-switcher').selectOption('pt')

    await expect(page.getByText('as vossas salas', { exact: true })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt')
  })
})
