import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(here, 'src'),
      // `server-only` is a Next.js client-side guard. In Vitest's node env
      // there's no client to protect, so alias it to an empty module so
      // imports succeed without pulling Next into the test surface.
      'server-only': path.resolve(here, 'src/test/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    testTimeout: 10_000,
  },
})
