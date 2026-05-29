import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Integration suite — slower than the unit run (testcontainers Postgres
 * + MinIO boot once via globalSetup, then every `*.integration.test.ts`
 * file shares the warm stack). Kept off the default `bun run test`
 * pathway so the unit tier stays sub-second.
 *
 *   bun run --cwd products/menu test:integration
 */
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist'],
    environment: 'node',
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 120_000,
    globalSetup: ['./tests/integration/global-setup.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/', import.meta.url)),
    },
  },
})
