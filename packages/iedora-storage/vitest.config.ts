import { defineConfig } from 'vitest/config'

/**
 * Pure unit tests — no live S3 calls. The SDK is not mocked at the network
 * layer; instead each test exercises pure helpers (`keyFromPublicUrl`,
 * factory env-var detection, error mapping). Live roundtrips live in each
 * consuming product's e2e suite (see menu's `storage.spec.ts`).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 5_000,
  },
})
