import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright end-to-end config for the web app.
 *
 * These specs drive the REAL app in a browser but stay backend-free: they cover
 * the public surfaces (house + menu landing), responsive behaviour down to a
 * 320px iPhone-4 viewport, client interactivity (the menu language switcher),
 * client-side form validation, and the auth/404 routing the middleware + RSCs
 * resolve without a service round-trip. Authenticated flows (which need the auth
 * + menu services) would live behind a `setup-auth` project writing storageState.
 *
 * webServer reuses the dev server when one is already running locally; CI starts
 * its own. Best practice is to run against a production build in CI — flip the
 * command to `bun run build && bun run start` there once the build is wired.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // The app stamps `data-test-id` (hyphenated), not Playwright's default `data-testid`.
    testIdAttribute: 'data-test-id',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'bun run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
