import { defineConfig, globalIgnores } from 'eslint/config'
import oxlint from 'eslint-plugin-oxlint'
import { next, boundaries, vitest } from '@iedora/eslint-config'

/**
 * Vantage's lint config — composes the shared @iedora/eslint-config factories,
 * mirroring the house surface. Vantage is a single super-admin console surface
 * (no vertical slices), so the boundaries `elements` list is minimal: everything
 * under `src/` is surface code. Kept structurally identical to house so the
 * surfaces stay easy to reconcile.
 */
const eslintConfig = defineConfig([
  ...next(),
  ...boundaries({
    elements: [{ type: 'shared', pattern: 'src/**' }],
  }),
  ...vitest(),
  // oxlint layer LAST — disables the ESLint rules the oxlint correctness
  // pre-pass already runs.
  ...oxlint.buildFromOxlintConfig({ categories: { correctness: 'error' } }),
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'next-env.d.ts',
    'eslint.config.mjs',
  ]),
])

export default eslintConfig
