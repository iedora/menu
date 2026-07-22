import { slugify as baseSlugify } from '@iedora/common'

/**
 * Pure: name → URL-safe slug, capped at 40 chars. Falls back to `"restaurant"`
 * when the input has no usable characters (just emojis/punctuation/whitespace)
 * so the caller always gets a valid seed to feed to `nextAvailableSlug`.
 */
export function slugify(value: string): string {
  return baseSlugify(value, { maxLen: 40, fallback: 'restaurant' })
}

/**
 * Slug-format check used at the rename boundary. Requires at least 2
 * characters (first + last must be alphanumeric, optional dashes in
 * between), max 40. Exposed here so the UI can disable the Save button
 * without round-tripping for validation.
 */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/
export function isValidSlugShape(value: string): boolean {
  return SLUG_RE.test(value)
}
