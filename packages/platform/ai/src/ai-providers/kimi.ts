/**
 * Kimi (Moonshot) provider factory.
 *
 * Returns AI SDK `LanguageModel` instances bound to Moonshot's
 * OpenAI-compatible endpoint. The package owns *only* vendor wiring —
 * consumers bring their own Zod schema, prompts, and `generateObject` /
 * `generateText` call shape.
 *
 * Two model families exposed today:
 *   - text   — `kimi-k2.6` (default text-chat model)
 *   - vision — `moonshot-v1-32k-vision-preview` (only family with image input)
 *
 * Override via `model` option when newer ids ship.
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

const BASE_URL = 'https://api.moonshot.ai/v1'

export const KIMI_MODELS = {
  text: 'kimi-k2.6',
  vision: 'moonshot-v1-32k-vision-preview',
} as const

export type KimiModelKind = keyof typeof KIMI_MODELS

export type KimiClientOptions = {
  /** Override the API key. Defaults to `MOONSHOT_API_KEY`. */
  apiKey?: string
}

export type KimiModelOptions = {
  /** Pick a preset model id (text vs vision). Default: `text`. */
  kind?: KimiModelKind
  /** Override the model id outright (wins over `kind`). */
  model?: string
}

export function createKimiClient(options: KimiClientOptions = {}) {
  const apiKey = options.apiKey ?? process.env.MOONSHOT_API_KEY
  if (!apiKey) {
    console.warn(
      '[ai/kimi] MOONSHOT_API_KEY is missing; calls will fail with an auth error.',
    )
  }

  const provider = createOpenAICompatible({
    name: 'kimi',
    baseURL: BASE_URL,
    apiKey: apiKey ?? '',
  })

  return {
    model(opts: KimiModelOptions = {}): LanguageModel {
      const id = opts.model ?? KIMI_MODELS[opts.kind ?? 'text']
      return provider(id)
    },
    raw: provider,
  }
}

export const _kimiConfig = { baseURL: BASE_URL, models: KIMI_MODELS } as const
