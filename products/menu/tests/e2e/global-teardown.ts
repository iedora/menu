/**
 * Runs once after the entire Playwright suite finishes, success or fail.
 *
 * Responsibility: TRUNCATE menu's domain + Better Auth client tables in
 * the test database so the dev environment isn't left polluted with
 * whatever the last spec wrote. Useful when you re-run a single spec
 * after a full pass — the test DB starts clean.
 *
 * The auth-testkit (its in-process PGLite) shuts down automatically when
 * Playwright SIGTERMs the bootstrap webServer at suite exit. Its own
 * shutdown handler removes the handle file and closes PGLite cleanly,
 * so we don't replicate that here.
 */
import postgres from 'postgres'

const TEST_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/menu_test'

async function truncateMenu(): Promise<void> {
  const sql = postgres(TEST_URL, { max: 1 })
  try {
    // Match the list in global-setup.ts. CASCADE walks the FKs.
    await sql`
      TRUNCATE TABLE
        "menu"."view_seen", "menu"."daily_view", "menu"."invoice",
        "menu"."item", "menu"."category", "menu"."menu",
        "menu"."restaurant", "menu"."org_plan",
        "menu"."session", "menu"."account", "menu"."verification",
        "menu"."rate_limit", "menu"."rate_limit_event", "menu"."user"
      RESTART IDENTITY CASCADE
    `
  } catch (err) {
    // Best-effort — the suite is exiting anyway; warn but don't crash.
    console.warn('[e2e teardown] menu truncate failed:', err)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

export default async function globalTeardown(): Promise<void> {
  await truncateMenu()
}
