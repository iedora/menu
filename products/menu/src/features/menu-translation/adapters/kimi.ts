/**
 * Kimi (Moonshot) translation adapter — one structured call per target
 * language. The use-case batches every stale row for a restaurant into
 * a single request per language; the model returns a JSON array of
 * strings in the same order as the input.
 *
 * Vendor wiring (base URL, env, model id) lives in `@iedora/ai/kimi`.
 * This file owns the domain: per-language prompt, schema, batch shape.
 *
 * `kimi-k2.6` would be faster on paper but JSON-mode is uneven (wraps
 * objects, drops fields under load). The 32k preview text-chat model is
 * conservative and stable — `ai` exposes both; the override below
 * pins the stable one.
 */
import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createKimiClient } from '@iedora/ai/kimi'
import type { LanguageCode } from '../../i18n'
import type { TranslationPort } from '../ports'

// `kimi-k2.6` JSON-mode is too lossy for batched translation — pin to
// the stable 32k text-chat model via the `model` override. ai
// keeps the preset as `kimi-k2.6`; this adapter takes the conservative
// path because batched translations cannot tolerate dropped fields.
const KIMI_TEXT_MODEL = 'moonshot-v1-32k'

// 8k buys headroom for verbose categories. A 50-item batch produces
// ~5k output tokens generously.
const MAX_OUTPUT_TOKENS = 8192

const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
  fr: 'French',
}

export function createKimiTranslationAdapter(
  options: { apiKey?: string } = {},
): TranslationPort {
  const kimi = createKimiClient({ apiKey: options.apiKey })
  const model = kimi.model({ model: KIMI_TEXT_MODEL })

  async function translateOneLanguage(
    fromLanguage: LanguageCode,
    toLanguage: LanguageCode,
    texts: string[],
  ): Promise<string[]> {
    const Schema = z.object({
      translations: z
        .array(z.string())
        .describe(
          'Translated strings in the SAME ORDER as the input. One entry per ' +
            'input string. Preserve any units, punctuation, and currency ' +
            'symbols verbatim. Do not add quotes around translations.',
        ),
    })

    const numbered = texts
      .map((t, i) => `${i + 1}. ${t}`)
      .join('\n')

    const system = `You are a menu translator.
Translate every line of the input from ${LANGUAGE_LABELS[fromLanguage]} to ${LANGUAGE_LABELS[toLanguage]}.

Rules:
- Return EXACTLY ${texts.length} translations in the same order as the input.
- Preserve the meaning of culinary terms — use the most common name for
  a dish in the target language. For dishes without a target-language
  name (e.g. "Bacalhau à brás" in English), keep the original name
  unchanged.
- Preserve punctuation, capitalisation style, units ("0.5L", "33cl"),
  abbreviations ("p/2 pessoas"), and any printed dietary markers (v),
  (gf).
- Do not add quotes, line numbers, or commentary.
- Do not paraphrase or expand abbreviations.`

    try {
      const { object } = await generateObject({
        model,
        schema: Schema,
        system,
        temperature: 0,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        prompt: `Translate these ${texts.length} strings:\n\n${numbered}`,
      })
      const result = [...object.translations]
      while (result.length < texts.length) result.push('')
      result.length = texts.length
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(
        `[menu-translation/kimi] ${fromLanguage}→${toLanguage} call failed`,
        err,
      )
      throw new Error(
        `Translation to ${LANGUAGE_LABELS[toLanguage]} failed: ${message}`,
      )
    }
  }

  return {
    async translate({ fromLanguage, toLanguages, fields }) {
      if (fields.length === 0 || toLanguages.length === 0) return []

      const sourceTexts = fields.map((f) => f.text)
      const settled = await Promise.allSettled(
        toLanguages.map(async (lang) => ({
          lang,
          texts: await translateOneLanguage(fromLanguage, lang, sourceTexts),
        })),
      )

      const perLanguage: { lang: LanguageCode; texts: string[] }[] = []
      const failed: { lang: LanguageCode; reason: string }[] = []
      for (let i = 0; i < settled.length; i += 1) {
        const outcome = settled[i]!
        const lang = toLanguages[i]!
        if (outcome.status === 'fulfilled') {
          perLanguage.push(outcome.value)
        } else {
          failed.push({
            lang,
            reason:
              outcome.reason instanceof Error
                ? outcome.reason.message
                : String(outcome.reason),
          })
        }
      }

      const translated = fields.map((field, idx) => {
        const translations: Partial<Record<LanguageCode, string>> = {}
        for (const { lang, texts } of perLanguage) {
          const value = texts[idx]
          if (value && value.trim().length > 0) {
            translations[lang] = value.trim()
          }
        }
        return { ...field, translations }
      })

      if (failed.length > 0) {
        const langs = failed.map((f) => f.lang.toUpperCase()).join(', ')
        const reasons = failed.map((f) => f.reason).join('; ')
        const err = new Error(
          `Translation failed for: ${langs}. ${reasons}`,
        ) as Error & { failedLanguages?: LanguageCode[] }
        err.failedLanguages = failed.map((f) => f.lang)
        throw err
      }

      return translated
    },
  }
}

export const kimiTranslationAdapter = createKimiTranslationAdapter()
