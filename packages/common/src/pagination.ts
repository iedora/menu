/** Options for {@link clampLimit}. */
export interface ClampLimitOptions {
  /** Returned when the input is missing or out of range (default 50). */
  def?: number
  /** Largest allowed value (default 200). */
  max?: number
}

/**
 * Normalise a caller-supplied page size to a safe bound: a positive integer no
 * greater than `max`, else `def`. Keeps a client from asking for an unbounded
 * (or nonsensical) result set.
 */
export function clampLimit(n: number | undefined, opts: ClampLimitOptions = {}): number {
  const { def = 50, max = 200 } = opts
  return n && n > 0 && n <= max ? n : def
}
