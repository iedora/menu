/**
 * @iedora/ai — provider-agnostic AI surface.
 *
 * Each provider exports a `create<Vendor>Client()` factory returning an
 * AI SDK `LanguageModel`. The package owns vendor wiring only — base
 * URL, env var, model id. Domain concerns (Zod schemas, prompts, ports)
 * stay in the consuming product.
 *
 * Consumers can deep-import the provider directly to avoid pulling the
 * full barrel:
 *
 *   import { createKimiClient } from '@iedora/ai/kimi'
 *   import { createDeepseekClient } from '@iedora/ai/deepseek'
 */
export {
  createKimiClient,
  KIMI_MODELS,
  type KimiClientOptions,
  type KimiModelKind,
  type KimiModelOptions,
} from './ai-providers/kimi'

export {
  createDeepseekClient,
  DEEPSEEK_MODELS,
  type DeepseekClientOptions,
  type DeepseekModelKind,
  type DeepseekModelOptions,
} from './ai-providers/deepseek'
