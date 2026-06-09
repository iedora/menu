import { defineConfig, globalIgnores } from 'eslint/config'
import { base, typescript, vitest } from '@iedora/eslint-config'

/**
 * @iedora/db: drizzle-orm + postgres-js setup. Server-only at runtime —
 * holds a postgres connection pool per consumer. Generic over schema.
 */
const eslintConfig = defineConfig([
  ...base(),
  ...typescript(),
  ...vitest(),
  {
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        globalThis: 'readonly',
        URL: 'readonly',
      },
    },
  },
  globalIgnores(['dist/**', 'eslint.config.mjs']),
])

export default eslintConfig
