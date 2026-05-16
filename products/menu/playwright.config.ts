import { defineConfig, devices } from '@playwright/test'

const PORT = 3000
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e/specs',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    // Better Auth enforces an Origin header on state-changing requests as CSRF
    // protection. Browser navigation sets it automatically; the `request`
    // fixture does not, so we set it globally here.
    extraHTTPHeaders: { Origin: BASE_URL },
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Must run a production build — Cache Components only behave correctly
    // under `next start`, not the dev server. In CI the build runs as a
    // dedicated step (with Node, not Bun — see AGENTS.md note on
    // oven-sh/bun#23944), so we skip the local `build` here to avoid a
    // double-build.
    command: process.env.CI
      ? 'bun run start'
      : 'bun run build && bun run start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/metamenu_test',
      BETTER_AUTH_SECRET:
        'test-secret-do-not-use-in-prod-test-secret-do-not-use-in-prod',
      BETTER_AUTH_URL: BASE_URL,
      DISABLE_AUTH_RATE_LIMIT: 'true',
      // Storage — LocalStack via docker-compose. Separate bucket so tests
      // don't collide with dev assets.
      S3_ENDPOINT: 'http://localhost:4566',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY: 'test',
      S3_SECRET_KEY: 'test',
      S3_BUCKET: 'metamenu-test',
    },
  },
})
