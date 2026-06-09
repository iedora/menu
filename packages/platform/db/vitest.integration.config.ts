import { defineConfig } from 'vitest/config'

/**
 * Integration suite for the shared migration runner — boots a real
 * Postgres via testcontainers (no globalSetup; the single suite owns its
 * container lifecycle in beforeAll/afterAll). Kept off the default
 * `bun run test` pathway so the unit tier stays Docker-free.
 *
 *   bun run --cwd packages/platform/db test:integration
 */
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    environment: 'node',
    pool: 'forks',
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
