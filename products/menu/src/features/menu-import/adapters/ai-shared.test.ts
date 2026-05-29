/**
 * Cross-provider tests for the menu-import AI flow. Every concrete
 * provider (Kimi today, OpenAI / Claude later) leans on these helpers,
 * so a regression here would surface across all of them.
 *
 * Per-provider quirks (model name, base URL, request shaping) get their
 * own tests in the matching `ai-<provider>.test.ts` file.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  classifyError,
  mapAIResponseToParsedMenu,
  MenuOutputSchema,
  MenuPatchSchema,
  normalizePatchOperations,
} from './ai-shared'

vi.mock('server-only', () => ({}))

// ── Schema resilience ──────────────────────────────────────────────────────

describe('AI schema · item field defaults', () => {
  it('accepts a fully-specified item unchanged', () => {
    const parsed = MenuOutputSchema.parse({
      language: 'pt',
      currency: 'EUR',
      categories: [
        {
          name: 'Entradas',
          items: [
            {
              name: 'Azeitonas',
              description: 'casa',
              priceCents: 200,
              confidence: 0.95,
            },
          ],
        },
      ],
    })
    expect(parsed.categories[0]?.items[0]).toEqual({
      name: 'Azeitonas',
      description: 'casa',
      priceCents: 200,
      confidence: 0.95,
    })
  })

  it("fills missing `confidence` with 1 (providers drop it on items they're certain about)", () => {
    const parsed = MenuOutputSchema.parse({
      language: 'pt',
      currency: 'EUR',
      categories: [
        {
          name: 'Entradas',
          items: [{ name: 'Pão com manteiga', priceCents: 250 }],
        },
      ],
    })
    expect(parsed.categories[0]?.items[0]?.confidence).toBe(1)
  })

  it('fills missing `priceCents` with 0 (providers sometimes omit it for unpriced items)', () => {
    const parsed = MenuOutputSchema.parse({
      language: 'pt',
      currency: 'EUR',
      categories: [
        {
          name: 'Sobremesas',
          items: [{ name: 'Fruta da época' }],
        },
      ],
    })
    expect(parsed.categories[0]?.items[0]?.priceCents).toBe(0)
  })

  it('allows `description` to stay undefined when not present on the menu', () => {
    const parsed = MenuOutputSchema.parse({
      language: 'pt',
      currency: 'EUR',
      categories: [
        {
          name: 'Bebidas',
          items: [{ name: 'Água', priceCents: 100 }],
        },
      ],
    })
    expect(parsed.categories[0]?.items[0]?.description).toBeUndefined()
  })

  it("still rejects items with no `name` — the one field we can't derive", () => {
    const result = MenuOutputSchema.safeParse({
      language: 'pt',
      currency: 'EUR',
      categories: [{ name: 'Entradas', items: [{ priceCents: 200 }] }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts an item with one or more variants', () => {
    const parsed = MenuOutputSchema.parse({
      language: 'pt',
      currency: 'EUR',
      categories: [
        {
          name: 'Pratos principais',
          items: [
            {
              name: 'Bacalhau à brás',
              priceCents: 1450,
              variants: [{ label: 'Meia dose', priceCents: 800 }],
            },
          ],
        },
      ],
    })
    expect(parsed.categories[0]?.items[0]?.variants).toEqual([
      { label: 'Meia dose', priceCents: 800 },
    ])
  })

  it('lets the AI omit `variants` entirely on single-price items', () => {
    const parsed = MenuOutputSchema.parse({
      language: 'pt',
      currency: 'EUR',
      categories: [
        {
          name: 'Bebidas',
          items: [{ name: 'Café (Bica)', priceCents: 100 }],
        },
      ],
    })
    expect(parsed.categories[0]?.items[0]?.variants).toBeUndefined()
  })
})

describe('AI schema · top-level defaults', () => {
  it('fills missing `currency` with an empty string (no symbol on the menu)', () => {
    const parsed = MenuOutputSchema.parse({
      language: 'en',
      categories: [
        { name: 'Coffee', items: [{ name: 'Espresso', priceCents: 150 }] },
      ],
    })
    expect(parsed.currency).toBe('')
  })

  it('rejects unknown language codes (closed enum)', () => {
    const result = MenuOutputSchema.safeParse({
      language: 'de',
      currency: 'EUR',
      categories: [],
    })
    expect(result.success).toBe(false)
  })

  it('fills missing `categories` with an empty array', () => {
    const parsed = MenuOutputSchema.parse({ language: 'en' })
    expect(parsed.categories).toEqual([])
  })
})

// ── Response mapping ───────────────────────────────────────────────────────

describe('AI response → ParsedMenu', () => {
  it('stamps `available: true` on every item regardless of price', () => {
    const mapped = mapAIResponseToParsedMenu({
      language: 'pt',
      currency: 'EUR',
      categories: [
        {
          name: 'Snacks',
          items: [
            // €0 stays available — a free item, not unavailable.
            { name: 'Pão da casa', priceCents: 0, confidence: 1 },
            { name: 'Azeitonas', priceCents: 200, confidence: 1 },
          ],
        },
      ],
    })
    expect(mapped.categories[0]?.items.every((item) => item.available)).toBe(true)
  })

  it('preserves description, price, and confidence', () => {
    const mapped = mapAIResponseToParsedMenu({
      language: 'en',
      currency: 'EUR',
      categories: [
        {
          name: 'Mains',
          items: [
            {
              name: 'Bacalhau à brás',
              description: 'salt cod, eggs, potato straws',
              priceCents: 1450,
              confidence: 0.6,
            },
          ],
        },
      ],
    })
    const item = mapped.categories[0]?.items[0]
    expect(item?.name).toBe('Bacalhau à brás')
    expect(item?.description).toBe('salt cod, eggs, potato straws')
    expect(item?.priceCents).toBe(1450)
    expect(item?.confidence).toBe(0.6)
    expect(item?.available).toBe(true)
  })

  it('round-trips an empty-categories response (model says "not a menu")', () => {
    const mapped = mapAIResponseToParsedMenu({
      language: 'en',
      currency: '',
      categories: [],
    })
    expect(mapped.categories).toEqual([])
    expect(mapped.language).toBe('en')
    expect(mapped.currency).toBe('')
  })

  it('forwards variants when the AI provided them', () => {
    const mapped = mapAIResponseToParsedMenu({
      language: 'pt',
      currency: 'EUR',
      categories: [
        {
          name: 'Mains',
          items: [
            {
              name: 'Bacalhau à brás',
              priceCents: 1450,
              confidence: 1,
              variants: [{ label: 'Meia dose', priceCents: 800 }],
            },
          ],
        },
      ],
    })
    expect(mapped.categories[0]?.items[0]?.variants).toEqual([
      { label: 'Meia dose', priceCents: 800 },
    ])
  })

  it('drops the `variants` property entirely when the AI returned none', () => {
    const mapped = mapAIResponseToParsedMenu({
      language: 'pt',
      currency: 'EUR',
      categories: [
        {
          name: 'Bebidas',
          items: [{ name: 'Café (Bica)', priceCents: 100, confidence: 1 }],
        },
      ],
    })
    expect(
      Object.prototype.hasOwnProperty.call(
        mapped.categories[0]?.items[0] ?? {},
        'variants',
      ),
    ).toBe(false)
  })
})

// ── Error classification ───────────────────────────────────────────────────

describe('Error classification', () => {
  it('treats billing / quota / rate-limit signals as `quota`', () => {
    expect(
      classifyError(new Error('Your prepayment credits are depleted')),
    ).toBe('quota')
    expect(classifyError(new Error('quota exceeded'))).toBe('quota')
    expect(classifyError(new Error('rate limit hit'))).toBe('quota')
    expect(classifyError(new Error('HTTP 429 Too Many Requests'))).toBe('quota')
  })

  it('treats key / permission signals as `auth`', () => {
    expect(classifyError(new Error('Invalid API key'))).toBe('auth')
    expect(classifyError(new Error('401 Unauthorized'))).toBe('auth')
    expect(classifyError(new Error('403 Forbidden'))).toBe('auth')
  })

  it('treats transport problems as `network`', () => {
    expect(classifyError(new Error('fetch failed'))).toBe('network')
    expect(classifyError(new Error('ECONNRESET'))).toBe('network')
    expect(classifyError(new Error('Request timeout'))).toBe('network')
  })

  it('treats truncated-JSON signatures as `truncated` (model hit maxOutputTokens)', () => {
    expect(
      classifyError(new Error('Unterminated string in JSON at position 3149')),
    ).toBe('truncated')
    expect(classifyError(new Error('Unexpected end of JSON input'))).toBe(
      'truncated',
    )
  })

  it('treats schema / parse mismatches as `parse`', () => {
    expect(
      classifyError(new Error('schema validation failed for `confidence`')),
    ).toBe('parse')
    expect(classifyError(new Error('Invalid response from model'))).toBe(
      'parse',
    )
  })

  it('falls back to `unknown` for unfamiliar errors', () => {
    expect(classifyError(new Error('something went sideways'))).toBe('unknown')
    expect(classifyError('a string, not an Error')).toBe('unknown')
  })
})

// ── PATCH-mode schema + normalization ─────────────────────────────────────
//
// Regression coverage for the Moonshot/openai-compatible structured-output
// drift that ate a production patch flow: the model returned ops like
// `{"add-category": {…}}` (kind as a wrapper key) and no `language`,
// so a strict discriminated-union schema rejected the whole response.
// We now use a flat schema + `normalizePatchOperations`, and these tests
// pin down the contract so a future refactor can't silently re-tighten
// the schema.

describe('MenuPatchSchema · resilience to model drift', () => {
  it('accepts well-formed flat ops with a `kind` field', () => {
    const parsed = MenuPatchSchema.parse({
      language: 'pt',
      currency: 'EUR',
      operations: [
        { kind: 'add-category', name: 'Entradas', items: [{ name: 'Pão', priceCents: 150 }] },
        { kind: 'update-item', itemId: 'i_1', priceCents: 1500 },
        { kind: 'remove-item', itemId: 'i_2' },
      ],
    })
    expect(parsed.operations).toHaveLength(3)
    expect(parsed.language).toBe('pt')
  })

  it('fills in a default language + currency when the model omits them', () => {
    // Moonshot has been observed to drop top-level metadata when it
    // focuses on the operations array. Defaults keep the patch usable.
    const parsed = MenuPatchSchema.parse({ operations: [] })
    expect(parsed.language).toBe('en')
    expect(parsed.currency).toBe('')
    expect(parsed.operations).toEqual([])
  })

  it('rejects ops with an unknown `kind` value', () => {
    expect(() =>
      MenuPatchSchema.parse({
        language: 'en',
        currency: 'EUR',
        operations: [{ kind: 'reorder-category', categoryId: 'c_1' }],
      }),
    ).toThrow()
  })
})

describe('normalizePatchOperations · widens loose AI output into PatchOperation', () => {
  it('passes through every supported op kind', () => {
    const ops = normalizePatchOperations([
      { kind: 'add-category', name: 'Entradas', items: [{ name: 'Pão', priceCents: 150 }] },
      { kind: 'remove-category', categoryId: 'c_1' },
      { kind: 'rename-category', categoryId: 'c_2', name: 'Sobremesas' },
      { kind: 'add-item', categoryId: 'c_3', name: 'Café', priceCents: 100 },
      { kind: 'add-item', categoryId: null, categoryName: 'Bebidas', name: 'Água', priceCents: 120 },
      { kind: 'update-item', itemId: 'i_1', priceCents: 1500 },
      { kind: 'remove-item', itemId: 'i_2' },
    ])
    expect(ops.map((o) => o.kind)).toEqual([
      'add-category',
      'remove-category',
      'rename-category',
      'add-item',
      'add-item',
      'update-item',
      'remove-item',
    ])
  })

  it('drops ops that are missing the fields their kind requires', () => {
    const ops = normalizePatchOperations([
      // add-category without a name → drop
      { kind: 'add-category', items: [{ name: 'x', priceCents: 100 }] },
      // remove-category without categoryId → drop
      { kind: 'remove-category' },
      // rename-category missing name → drop
      { kind: 'rename-category', categoryId: 'c_1' },
      // add-item with no parent (no categoryId, no categoryName) → drop
      { kind: 'add-item', name: 'orphan', priceCents: 100 },
      // update-item with itemId but no actual field changes → drop (no-op)
      { kind: 'update-item', itemId: 'i_1' },
      // remove-item missing itemId → drop
      { kind: 'remove-item' },
    ])
    expect(ops).toEqual([])
  })

  it('zero-pads missing prices on add ops rather than failing', () => {
    // Cast through the schema's input type — `priceCents` is `.default(0)`
    // so it's optional on input even though the inferred output type
    // requires it. We want to assert the normalizer survives a model
    // that omits the price field entirely.
    const ops = normalizePatchOperations([
      {
        kind: 'add-category',
        name: 'Entradas',
        items: [{ name: 'Mistério' } as unknown as { name: string; priceCents: number }],
      },
      { kind: 'add-item', categoryId: 'c_1', name: 'Sem preço' },
    ])
    expect(ops).toEqual([
      { kind: 'add-category', name: 'Entradas', items: [{ name: 'Mistério', priceCents: 0 }] },
      { kind: 'add-item', categoryId: 'c_1', name: 'Sem preço', priceCents: 0 },
    ])
  })

  it('keeps update-item partial when ANY field is set', () => {
    const ops = normalizePatchOperations([
      { kind: 'update-item', itemId: 'i_1', name: 'novo nome' },
      { kind: 'update-item', itemId: 'i_2', priceCents: 0 }, // priceCents=0 is meaningful (free)
      { kind: 'update-item', itemId: 'i_3', description: 'nota' },
    ])
    expect(ops).toEqual([
      { kind: 'update-item', itemId: 'i_1', name: 'novo nome' },
      { kind: 'update-item', itemId: 'i_2', priceCents: 0 },
      { kind: 'update-item', itemId: 'i_3', description: 'nota' },
    ])
  })
})
