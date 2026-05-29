/**
 * Live end-to-end test of the Kimi adapter's PATCH path. Mirrors
 * `ai-kimi.live.test.ts` but exercises `parseMenuPatch` — the flow
 * that broke in prod when Moonshot returned ops in object-keyed shape
 * (`{"add-category": {…}}`) instead of `{kind: "add-category", …}`.
 *
 * Off by default — runs only when `MOONSHOT_API_KEY` is present. Costs
 * Kimi credits per execution.
 *
 *   bun run test:ai-live      # exposes the env, runs both live files
 *
 * We pass an EMPTY current menu to the same Taberna do José fixture.
 * Empty current + real photo guarantees the model returns at least a
 * couple of `add-category` ops, which is exactly what makes this
 * regression visible: if the schema/normalizer drift, no add-category
 * ops survive.
 */

import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createKimiAdapter } from './ai-kimi'

vi.mock('server-only', () => ({}))

const HAS_KEY = Boolean(process.env.MOONSHOT_API_KEY)
const FIXTURE = join(
  process.cwd(),
  'tests/fixtures/ai/menu-taberna-do-jose.png',
)

const describeLive = HAS_KEY ? describe : describe.skip

describeLive('Kimi adapter · live · patch · Taberna do José', () => {
  it(
    'returns valid add-category ops when given an empty current menu',
    async () => {
      // Embed the image as a data: URL so the adapter's fetchImageBytes
      // step works without needing localhost MinIO running.
      const buf = await readFile(FIXTURE)
      const dataUrl = `data:image/png;base64,${buf.toString('base64')}`

      const adapter = createKimiAdapter()
      const result = await adapter.parseMenuPatch({
        imageUrl: dataUrl,
        current: { language: 'en', currency: '', categories: [] },
      })

      if ('error' in result) {
        throw new Error(
          `Live patch call failed: ${result.error} (code=${result.code})`,
        )
      }

      // Sanity on top-level metadata. The model has to fill in the
      // language (pt for a Portuguese menu) — drift here was one of
      // the symptoms of the original bug.
      expect(result.language).toBe('pt')
      expect(result.currency).toBe('EUR')

      // With an empty current menu, every visible section should land
      // as an `add-category` op. The Taberna do José fixture has four.
      const addCategoryOps = result.operations.filter(
        (op) => op.kind === 'add-category',
      )
      expect(addCategoryOps.length).toBeGreaterThanOrEqual(3)

      // Every op the adapter returns must have a string `kind` matching
      // the strict PatchOperation union. If the normalizer ever stops
      // mapping the model's loose shape into our union, this fails.
      const VALID_KINDS = new Set([
        'add-category',
        'remove-category',
        'rename-category',
        'add-item',
        'update-item',
        'remove-item',
      ])
      for (const op of result.operations) {
        expect(VALID_KINDS.has(op.kind)).toBe(true)
      }

      // Spot-check that at least one add-category op carries items —
      // an empty-items add-category against this fixture would mean the
      // model emitted items in some other shape we silently dropped.
      const withItems = addCategoryOps.filter(
        (op) => op.kind === 'add-category' && op.items.length > 0,
      )
      expect(withItems.length).toBeGreaterThan(0)
    },
    90_000,
  )
})

if (!HAS_KEY) {
  console.info(
    '[ai-kimi-patch.live] skipped — set MOONSHOT_API_KEY to run.',
  )
}
