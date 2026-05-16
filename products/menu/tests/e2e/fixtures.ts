import { test as base, expect } from '@playwright/test'

/**
 * Why this exists:
 *
 * A Server Component that passed an inline `onClick` to a Client `<Link>`
 * shipped to main and crashed every dashboard render. The existing specs DO
 * exercise that path — but with no error listener, the failure surfaces ~5–30s
 * later as a "locator not found" timeout. The actual cause ("Event handlers
 * cannot be passed to Client Component props") is buried in the dev/server log.
 *
 * This fixture wires the page so any uncaught client error, or any 5xx on a
 * document/RSC response, fails the test immediately with the real message.
 *
 * Tests opt in by importing `{ test, expect }` from here instead of
 * `@playwright/test`.
 */

type Fixtures = {
  /**
   * Read-only handle for tests that want to inspect captured errors mid-run.
   * Most tests don't need to touch this — afterEach asserts emptiness.
   */
  pageErrors: string[]
}

export const test = base.extend<Fixtures>({
  // `auto: true` so every test importing from this file is guarded, even if it
  // never references `pageErrors` directly.
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = []

      page.on('pageerror', (err) => {
        errors.push(`Uncaught client error: ${err.message}`)
      })

      page.on('response', async (response) => {
        if (response.status() < 500) return
        const ct = response.headers()['content-type'] ?? ''
        // Only document and RSC payloads — skip 5xx on assets/HMR/etc.
        if (!ct.startsWith('text/html') && !ct.startsWith('text/x-component')) return

        const body = await response.text().catch(() => '')
        const snippet =
          body.match(/"message":"([^"]+)"/)?.[1] ??
          body.match(/<pre[^>]*>([^<]+)<\/pre>/)?.[1] ??
          body.slice(0, 400)
        errors.push(
          `Server ${response.status()} on ${new URL(response.url()).pathname}\n  ${snippet}`,
        )
      })

      await use(errors)

      if (errors.length > 0) {
        throw new Error(
          `Page reported ${errors.length} uncaught error(s):\n\n${errors.join('\n\n')}`,
        )
      }
    },
    { auto: true },
  ],
})

export { expect }
