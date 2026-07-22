/** True if `tz` is an IANA zone the runtime accepts — rejects junk before it
 *  reaches a database or a date library. */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** The viewer's IANA zone as the browser reports it, or `fallback` when it can't
 *  be resolved (non-browser runtime, locked-down environment). */
export function browserTimezone(fallback = "UTC"): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback
}
