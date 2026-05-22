/**
 * Provider-agnostic helpers for the menu-import AI flow. Every concrete
 * adapter file (`ai-kimi.ts`, future `ai-openai.ts`, `ai-claude.ts`, …)
 * imports from here so the schema, prompt, mapping, error classification,
 * and image fetcher stay in lockstep across providers.
 *
 * Provider-specific bits — base URL, model name, max output tokens,
 * any vendor request quirks — live in the per-provider file. That file
 * implements `ImageAnalysisPort` from `../ports`; consumers depend on the
 * port, not on any specific provider (strategy pattern, dependency
 * inversion).
 *
 * Tests live next to this file (`ai-shared.test.ts`) for the cross-
 * provider concerns, and next to each provider file for its specifics.
 */
import 'server-only'
import { z } from 'zod'
import type { ParseMenuErrorCode, ParseMenuResult } from '../ports'

// ── Schema ────────────────────────────────────────────────────────────────

// Keep in sync with `LANGUAGE_CODES` in `@/features/i18n/registry`. The
// model's schema needs literal values (z.enum can't take a runtime
// `readonly string[]`); adding a language to the registry means adding it
// here too.
const LanguageAISchema = z
  .enum(['en', 'pt', 'es', 'fr'])
  .describe(
    'ISO 639-1 language code matching the language the menu is written in. ' +
      "Use 'en' as the fallback when the menu's language isn't one of these.",
  )

// Every nice-to-have field has a `.default()` so the model can skip it
// without hard-failing the import. LLMs routinely drop fields they
// consider redundant or self-evident (a clean €12.50 price doesn't need
// confidence=1.0 spelled out, in their eyes). The defaults let us
// degrade gracefully. Required: `name`. Everything else has a fallback.
//
// `available` is deliberately NOT on this schema — items always import
// as available; the operator manages availability later via the menu
// builder. A €0 price means "free", not "unavailable".
const ParsedVariantAISchema = z.object({
  label: z
    .string()
    .describe(
      'Variant label as written on the menu (e.g. "Meia dose", "Imperial", ' +
        '"Jarra 1L"). Keep the original language.',
    ),
  priceCents: z
    .number()
    .int()
    .min(0)
    .describe('Price for this variant in integer cents.'),
})

const ParsedItemAISchema = z.object({
  name: z.string().describe('Name of the dish or drink exactly as written on the menu'),
  description: z
    .string()
    .optional()
    .describe('Short description of the dish, if present on the menu'),
  priceCents: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe(
      'Primary / leftmost price for this dish in integer cents (e.g. €12.50 ' +
        '→ 1250). Use 0 if no price is visible.',
    ),
  variants: z
    .array(ParsedVariantAISchema)
    .optional()
    .describe(
      'Alternate prices for the same dish (e.g. half-dose, small/large, ' +
        'beer sizes, wine pours). Use this whenever the menu lists more ' +
        'than one price for a single named dish. Omit entirely when there ' +
        "'s just one price.",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .default(1)
    .describe(
      'Your confidence in this row, 0 to 1. Drop below 0.7 when the photo ' +
        'is blurry around this item, when OCR was ambiguous, or when you had ' +
        "to guess at the price. Use 1.0 only when you're certain.",
    ),
})

const ParsedCategoryAISchema = z.object({
  name: z.string().describe('Category or section name (e.g. "Starters", "Main Courses")'),
  items: z.array(ParsedItemAISchema),
})

export const MenuOutputSchema = z.object({
  language: LanguageAISchema,
  currency: z
    .string()
    .default('')
    .describe(
      "ISO 4217 currency code matching the menu's prices (e.g. 'EUR', 'USD', " +
        "'GBP'). Empty string when no currency symbol is visible.",
    ),
  categories: z
    .array(ParsedCategoryAISchema)
    .default([])
    .describe('All categories extracted from the menu image, in order of appearance'),
})

export type MenuOutput = z.infer<typeof MenuOutputSchema>

// ── Prompt ────────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are a menu-digitisation assistant.
The user will provide a photo of a restaurant menu (physical or digital).
Your job is to extract ALL visible categories and menu items from the image,
plus the menu's language and currency.

Rules:
- Detect the menu's language and return it as the ISO 639-1 code ('en', 'pt',
  'es', or 'fr'). Use 'en' as the fallback when the menu is in a language
  outside this set.
- Detect the currency from the visible price symbol and return the ISO 4217
  code ('EUR' for €, 'USD' for $, 'GBP' for £, etc.). Return an empty string
  when no currency symbol is visible.
- Preserve the original language of the menu text in names and descriptions.
- Keep names and descriptions exactly as written (correct obvious OCR errors).
- Convert prices to integer cents (€12.50 → 1250, $8 → 800). Use 0 when no
  price is visible.
- If a single dish lists multiple prices (full / half dose, small / large,
  lunch / dinner, by-the-glass / by-the-bottle, jarra 0.5L / 1L), use the
  LEFTMOST / PRIMARY price for \`priceCents\` and put each ALTERNATE into the
  \`variants\` array with its label as written on the menu, e.g.
  \`variants: [{ label: "Meia dose", priceCents: 800 }]\`. DO NOT create
  separate categories for alternate price columns. DO NOT duplicate the
  item just to capture a second price. Each dish appears exactly once.
- Omit \`variants\` entirely when the dish has only one price.
- Set confidence per item: 1.0 when you're certain, lower when OCR was
  ambiguous or you had to guess. Drop below 0.7 for hard-to-read rows so the
  operator can review them.
- If you see a category without items listed, include it with an empty items
  array.
- Do not invent items or prices that are not visible in the image.
- If the image is not a menu, return an empty categories array.`

export const USER_PROMPT = 'Extract all menu categories and items from this image.'

// ── Response mapping ──────────────────────────────────────────────────────

/**
 * Provider-agnostic response mapper. Takes the validated model output
 * (whatever provider produced it) and produces the slice's `ParsedMenu`.
 * Stamps `available: true` on every item — `available` is not a field
 * we extract; it's the operator's call after import.
 */
export function mapAIResponseToParsedMenu(
  object: MenuOutput,
): Extract<ParseMenuResult, { language: unknown }> {
  return {
    language: object.language,
    currency: object.currency,
    categories: object.categories.map((category) => ({
      name: category.name,
      items: category.items.map((item) => ({
        name: item.name,
        description: item.description,
        priceCents: item.priceCents,
        available: true,
        confidence: item.confidence,
        // Drop the variants property entirely when the AI didn't return
        // any — keeps the parsed shape free of `variants: undefined`
        // noise downstream.
        ...(item.variants && item.variants.length > 0
          ? { variants: item.variants }
          : {}),
      })),
    })),
  }
}

// ── Error classification ──────────────────────────────────────────────────

/**
 * Inspects an SDK error message and groups it into one of the coarse
 * buckets the UI knows about. We deliberately match strings rather than
 * vendor-specific error classes — Kimi, OpenAI, Gemini, Claude all
 * surface the same patterns ("rate limit", "quota", "credits") and we
 * want the same friendly copy regardless of who's behind the curtain.
 */
export function classifyError(err: unknown): ParseMenuErrorCode {
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase()
  // Truncation fingerprint — JSON output cut off mid-string. The model
  // hit its `maxOutputTokens` cap before closing the response. Distinct
  // from a "blurry photo" parse failure because the AI did read the image,
  // it just ran out of room to write the result.
  if (
    message.includes('unterminated string') ||
    message.includes('unterminated') ||
    message.includes('unexpected end of') ||
    message.includes('truncated')
  ) {
    return 'truncated'
  }
  if (
    message.includes('credit') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('rate-limit') ||
    message.includes('billing') ||
    message.includes('429')
  ) {
    return 'quota'
  }
  if (
    message.includes('api key') ||
    message.includes('apikey') ||
    message.includes('unauthorized') ||
    message.includes('unauthenticated') ||
    message.includes('forbidden') ||
    message.includes('401') ||
    message.includes('403')
  ) {
    return 'auth'
  }
  if (
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('network') ||
    message.includes('fetch failed')
  ) {
    return 'network'
  }
  if (
    message.includes('schema') ||
    message.includes('validation') ||
    message.includes('parse') ||
    message.includes('invalid response')
  ) {
    return 'parse'
  }
  return 'unknown'
}

// ── Image fetcher ─────────────────────────────────────────────────────────

/**
 * Fetches the just-uploaded image from our S3 bucket and hands the model
 * raw bytes. Provider-agnostic — every adapter calls this before the AI
 * request. We deliberately avoid passing the URL: in dev the bucket lives
 * on `localhost:4566` (LocalStack) which the AI provider can't reach, and
 * in prod the public URL would force a provider → R2 round-trip slower
 * than a same-region server-side fetch + inline bytes.
 */
export async function fetchImageBytes(
  imageUrl: string,
): Promise<
  | { bytes: Uint8Array; mediaType: string }
  | { error: string; code: ParseMenuErrorCode }
> {
  let res: Response
  try {
    res = await fetch(imageUrl)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      error: `Could not download the uploaded image (${message}).`,
      code: 'network',
    }
  }
  if (!res.ok) {
    return {
      error: `Could not download the uploaded image (HTTP ${res.status}).`,
      code: 'network',
    }
  }
  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const mediaType = contentType.startsWith('image/') ? contentType : 'image/jpeg'
  const buffer = await res.arrayBuffer()
  return { bytes: new Uint8Array(buffer), mediaType }
}
