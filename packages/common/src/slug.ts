/** Options for {@link slugify}. */
export interface SlugifyOptions {
  /** Max length before trimming (default 40). */
  maxLen?: number
  /** Shortest acceptable result; a shorter slug becomes the fallback (default 0). */
  minLen?: number
  /** Returned when nothing usable remains (default ""). */
  fallback?: string
}

/**
 * Derive a URL-safe slug from a display name: strip diacritics, lower-case,
 * collapse every run of non-alphanumerics to a single dash, trim edge dashes,
 * and cap at `maxLen`. Returns `fallback` when the result is empty or shorter
 * than `minLen`. Pure and framework-free.
 */
export function slugify(name: string, opts: SlugifyOptions = {}): string {
  const { maxLen = 40, minLen = 0, fallback = "" } = opts
  const s = name
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/g, "") // the slice may leave a trailing dash
  return s.length >= minLen && s.length > 0 ? s : fallback
}
