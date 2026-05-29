/**
 * Provider-scoped tests for the Kimi adapter. These cover Kimi's
 * specific configuration; cross-provider concerns (schema, mapping,
 * error classification) live in `ai-shared.test.ts`.
 *
 * Adding another provider? Mirror this file for it (`ai-openai.test.ts`,
 * `ai-claude.test.ts`) — each provider owns its own config tests so a
 * model-name typo or a base-URL drift surfaces locally without poking
 * the network.
 */

import { describe, expect, it, vi } from 'vitest'
import { createKimiAdapter } from './ai-kimi'

vi.mock('server-only', () => ({}))

// Vendor wiring (base URL, model id, env var) lives in `@iedora/ai/kimi`
// and is tested there. This file owns only the menu-import-specific
// construction contract.

describe('Kimi adapter · construction', () => {
  it('builds an adapter that exposes the `ImageAnalysisPort` shape', () => {
    const adapter = createKimiAdapter({ apiKey: 'test-key' })
    expect(typeof adapter.parseMenuFromImage).toBe('function')
  })

  it('still constructs (with a warning) when the API key is missing — the auth error surfaces at call time, not at module load', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const adapter = createKimiAdapter({ apiKey: undefined })
    expect(typeof adapter.parseMenuFromImage).toBe('function')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('MOONSHOT_API_KEY is missing'),
    )
    warn.mockRestore()
  })
})
