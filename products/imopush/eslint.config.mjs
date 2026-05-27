import { defineConfig, globalIgnores } from 'eslint/config'
import { base, typescript, react, vitest } from '@iedora/eslint-config'

/**
 * imopush lint config. Composes the shared @iedora/eslint-config
 * factories. NOT a Next.js app (this is a library workspace consumed
 * by apps/web), so we don't pull in `next()` — that plugin expects a
 * `pages/` or `src/pages/` directory and warns when it can't find
 * one. Boundaries plugin lands when the first slice tree does.
 */
const eslintConfig = defineConfig([
  ...base(),
  ...typescript(),
  ...react(),
  ...vitest(),
  globalIgnores(['dist/**', 'eslint.config.mjs']),
])

export default eslintConfig
