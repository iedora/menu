/**
 * DeepSeek V4 provider factory.
 *
 * Returns AI SDK `LanguageModel` instances bound to DeepSeek's
 * OpenAI-compatible endpoint. Two models exposed:
 *   - flash — `deepseek-v4-flash` (cheap text)
 *   - pro   — `deepseek-v4-pro`   (top reasoning/agentic)
 *
 * Vision note: V4 advertises native multimodal, but combining
 * `image_url` content parts with `response_format: json_object` (what
 * `generateObject` emits) currently 400s with `unknown variant
 * `image_url``. Until vercel/ai#9179 ships, treat DeepSeek as
 * text-only and route image input to a vision-friendly provider
 * (e.g. Kimi vision).
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

const BASE_URL = 'https://api.deepseek.com/v1'

export const DEEPSEEK_MODELS = {
  flash: 'deepseek-v4-flash',
  pro: 'deepseek-v4-pro',
} as const

export type DeepseekModelKind = keyof typeof DEEPSEEK_MODELS

export type DeepseekClientOptions = {
  /** Override the API key. Defaults to `DEEPSEEK_API_KEY`. */
  apiKey?: string
}

export type DeepseekModelOptions = {
  /** Pick a preset (`flash` cheap, `pro` strong). Default: `flash`. */
  kind?: DeepseekModelKind
  /** Override the model id outright. */
  model?: string
}

export function createDeepseekClient(options: DeepseekClientOptions = {}) {
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.warn(
      '[ai/deepseek] DEEPSEEK_API_KEY is missing; calls will fail with an auth error.',
    )
  }

  const provider = createOpenAICompatible({
    name: 'deepseek',
    baseURL: BASE_URL,
    apiKey: apiKey ?? '',
  })

  return {
    model(opts: DeepseekModelOptions = {}): LanguageModel {
      const id = opts.model ?? DEEPSEEK_MODELS[opts.kind ?? 'flash']
      return provider(id)
    },
    raw: provider,
  }
}

export const _deepseekConfig = {
  baseURL: BASE_URL,
  models: DEEPSEEK_MODELS,
} as const
