import type { LanguageCode } from '@/features/i18n'

/**
 * Ports for the menu-import slice.
 *
 * `ImageAnalysisPort` — stateless AI call. Production wires to Gemini 2.0 Flash
 * via `adapters/ai.ts`; tests wire a deterministic fake.
 *
 * `MenuImportPort` — DB writes that persist the parsed menu. Production wires
 * to `adapters/drizzle.ts`; tests wire a fake. Authorization happens in the
 * action shell (AGENTS.md hard rule #1); the port assumes the caller has
 * already verified `restaurantId` ownership.
 */

/**
 * Ad-hoc price variant carried alongside the primary `priceCents`. The
 * common Portuguese tasca pattern: `Dose / Meia dose`, `Imperial / Caneca`,
 * `Jarra 0.5L / 1L`. AI extracts these per item; operator can edit
 * them inline before persisting.
 */
export type ParsedVariant = {
  label: string
  priceCents: number
}

export type ParsedItem = {
  /** Display name of the item. */
  name: string
  /** Optional description. */
  description?: string
  /**
   * Primary / leftmost price in integer cents. 0 when the AI couldn't
   * detect a price (a legitimate "free" value too — bread, snacks).
   * AGENTS.md hard rule #6 — never floats.
   */
  priceCents: number
  /** Always true on import; operator manages availability via the menu builder. */
  available: boolean
  /**
   * Model's self-rated confidence for this row, 0–1. The wizard preview
   * flags rows below 0.7 so the operator double-checks them before
   * persisting. Defaults to 1 in tests / fakes that don't care.
   */
  confidence: number
  /**
   * Alternate prices for the same dish (half dose, sizes, etc.). Empty /
   * undefined for the common single-price case.
   */
  variants?: ParsedVariant[]
}

export type ParsedCategory = {
  name: string
  items: ParsedItem[]
}

export type ParsedMenu = {
  /**
   * Detected menu language. Falls back to 'en' when the AI can't pick a
   * supported language (we only ship en/pt/es/fr today).
   */
  language: LanguageCode
  /**
   * ISO 4217 currency code the AI read off the menu (e.g. 'EUR', 'USD').
   * Empty string when no currency symbol was visible — the operator can
   * still import; defaults match the org's existing setting in that case.
   */
  currency: string
  categories: ParsedCategory[]
}

/**
 * Why the AI flow couldn't produce a menu. The wizard maps the code to a
 * localized message — the `error` string is for server logs only and is
 * never shown to the operator (so vendor billing language doesn't leak).
 *
 *   - `quota`    : AI provider rejected for billing/quota/rate-limit.
 *   - `auth`     : API key invalid or permission denied (config issue).
 *   - `network`  : timeout / network failure reaching the provider.
 *   - `parse`    : provider returned, but the result didn't match our
 *                  schema or contained no items (e.g. blurry photo).
 *   - `unknown`  : anything else; the wizard surfaces a generic retry.
 */
export type ParseMenuErrorCode =
  | 'quota'
  | 'auth'
  | 'network'
  | 'parse'
  | 'truncated'
  | 'unknown'

export type ParseMenuError = {
  error: string
  code: ParseMenuErrorCode
}

export type ParseMenuResult = ParsedMenu | ParseMenuError

/** Stateless port for AI vision analysis. */
export interface ImageAnalysisPort {
  parseMenuFromImage(imageUrl: string): Promise<ParseMenuResult>
}

export type ImportResult =
  | { ok: true; menuId: string }
  | { error: string }

/** DB write port for persisting a parsed menu. */
export interface MenuImportPort {
  /** Appends a new menu after any existing menus. Returns the new menu id. */
  createMenu(restaurantId: string, name: string): Promise<string>

  /**
   * Inserts a category into an existing menu at the given position.
   * Returns the new category id.
   */
  insertCategory(
    menuId: string,
    restaurantId: string,
    name: string,
    position: number,
  ): Promise<string>

  /**
   * Inserts an item into a category at the given position.
   */
  insertItem(
    categoryId: string,
    restaurantId: string,
    fields: {
      name: string
      description?: string
      priceCents: number
      available: boolean
      variants?: ParsedVariant[]
    },
    position: number,
  ): Promise<void>

  /**
   * Overwrites the restaurant's `default_language` column. Only called
   * from the onboarding flow (the dialog wrapper leaves existing
   * restaurants alone). Returns true when a row was updated.
   */
  setRestaurantDefaultLanguage(
    restaurantId: string,
    language: LanguageCode,
  ): Promise<boolean>
}
