import { defineConfig, globalIgnores } from 'eslint/config'
import { base, typescript, vitest } from '@iedora/eslint-config'

/**
 * @iedora/storage: S3-compatible storage port. Node-only at runtime; no
 * React, no Next, no JSX — base + TS + vitest overrides cover it.
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
        performance: 'readonly',
      },
    },
  },
  globalIgnores(['dist/**', 'eslint.config.mjs']),
])

export default eslintConfig
