/**
 * The message of an unknown thrown value. `throw` can carry anything, so a
 * plain `err.message` is unsafe; this returns the message for real Errors and a
 * string form for everything else. The one-liner every catch block was copying.
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
