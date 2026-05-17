import { env } from '@/shared/env'

/**
 * Resolve a `return_to` query param to a safe redirect target.
 *
 * Rules:
 *   - Absolute URL whose origin is in TRUSTED_ORIGINS → keep as-is.
 *   - Any other absolute URL → reject (fall back to DEFAULT_RETURN_TO).
 *   - Relative path starting with `/` and NOT `//` (which is protocol-
 *     relative) → resolved against DEFAULT_RETURN_TO.
 *   - Anything else, including null → DEFAULT_RETURN_TO.
 *
 * Runs on the server (env access). Pass the result to the client form as
 * a plain string prop so the browser never sees the allowlist.
 */
export function resolveSafeReturnTo(raw: string | null | undefined): string {
  const fallback = env.DEFAULT_RETURN_TO
  if (!raw) return fallback

  // Absolute URL
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      const allowed = env.TRUSTED_ORIGINS
      if (allowed.includes(url.origin)) return url.toString()
    } catch {
      // fall through to fallback
    }
    return fallback
  }

  // Same-origin relative path
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) {
    try {
      return new URL(raw, fallback).toString()
    } catch {
      return fallback
    }
  }

  return fallback
}
