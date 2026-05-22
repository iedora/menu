import { test, expect } from '../../../../tests/e2e/fixtures'
import { dashboardRoutes } from '../testing'

/**
 * Dashboard chrome — vertical sidebar (lg+) with a mobile drawer (<lg).
 *
 * Spec exercises the contract the chrome owes the rest of the app:
 *   - the brand link round-trips home,
 *   - active-link state lights up the current route (via usePathname),
 *   - the locale switcher renders an inline row of flags with a
 *     pressed state on the current locale (default `en`),
 *   - logout is reachable as a real interactive button,
 *   - on mobile, the sidebar starts closed and the trigger opens it.
 *
 * All assertions go through `data-test-id` per menu rule 17 — text-based
 * lookups would drift with i18n + copy edits.
 */

test.describe('@smoke dashboard chrome', () => {
  test('renders the editorial header with brand, nav, locale, logout', async ({
    signedInPage,
  }) => {
    await signedInPage.goto(dashboardRoutes.home)

    await expect(signedInPage.getByTestId('dashboard-chrome')).toBeVisible()
    await expect(signedInPage.getByTestId('dashboard-home-link')).toBeVisible()
    await expect(signedInPage.getByTestId('dashboard-nav-billing')).toBeVisible()
    await expect(signedInPage.getByTestId('dashboard-locale-switcher')).toBeVisible()
    await expect(signedInPage.getByTestId('dashboard-logout')).toBeVisible()
  })

  test('active link highlights the current route', async ({ signedInPage }) => {
    await signedInPage.goto('/dashboard/billing')

    // The billing link is the current page — usePathname sets data-active.
    const billing = signedInPage.getByTestId('dashboard-nav-billing')
    await expect(billing).toHaveAttribute('data-active', 'true')
    await expect(billing).toHaveAttribute('aria-current', 'page')
  })

  test('locale switcher shows the current locale as pressed', async ({
    signedInPage,
  }) => {
    await signedInPage.goto(dashboardRoutes.home)

    // Default locale is `en` when no cookie is set; the EN button is
    // pressed and carries data-active="true".
    const en = signedInPage.getByTestId('dashboard-locale-en')
    await expect(en).toHaveAttribute('data-active', 'true')
    await expect(en).toHaveAttribute('aria-pressed', 'true')
  })

  test('flat pages render h1 only — no redundant Home breadcrumb', async ({
    signedInPage,
  }) => {
    await signedInPage.goto('/dashboard/billing')

    // Billing is 1-level deep; sidebar's active link is the back-affordance,
    // so we render just the page heading — no breadcrumb chrome.
    await expect(signedInPage.getByTestId('billing-heading')).toBeVisible()
    await expect(signedInPage.getByTestId('billing-breadcrumbs')).toHaveCount(0)
  })

  test('brand link navigates home', async ({ signedInPage }) => {
    await signedInPage.goto('/dashboard/billing')
    await signedInPage.getByTestId('dashboard-home-link').click()
    await expect(signedInPage).toHaveURL(/\/dashboard\/?$/)
  })

  test('mobile: trigger opens the sidebar drawer', async ({ signedInPage }) => {
    // Drop below the `lg` breakpoint so the drawer mechanics engage.
    await signedInPage.setViewportSize({ width: 390, height: 800 })
    await signedInPage.goto(dashboardRoutes.home)

    const sidebar = signedInPage.getByTestId('dashboard-chrome')
    const trigger = signedInPage.getByTestId('dashboard-sidebar-trigger')

    await expect(trigger).toBeVisible()
    await expect(sidebar).toHaveAttribute('data-open', 'false')

    await trigger.click()
    await expect(sidebar).toHaveAttribute('data-open', 'true')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    // Tapping the trigger a second time closes the drawer.
    await trigger.click()
    await expect(sidebar).toHaveAttribute('data-open', 'false')
  })
})
