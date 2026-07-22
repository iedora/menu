/**
 * Crockford-flavoured base32 minus the glyphs that are ambiguous read aloud or
 * retyped (0/O, 1/I/L, U). 30 symbols — good for human-facing short codes on
 * stickers, receipts, or URLs.
 */
// The Web Crypto global — standard on Node 18+ and every browser. Declared
// minimally here so this package needs neither the DOM lib nor @types/node.
declare const crypto: { getRandomValues<T extends Uint8Array>(array: T): T }

export const BASE32_UNAMBIGUOUS = "23456789abcdefghjkmnpqrstvwxyz"

/**
 * A random string of `len` characters drawn from `alphabet`, using the CSPRNG
 * (`crypto.getRandomValues`, available on Node 18+ and browsers). Modulo bias
 * is negligible for these small alphabets and non-cryptographic ID uses.
 */
export function randomString(len: number, alphabet = BASE32_UNAMBIGUOUS): string {
  const buf = new Uint8Array(len)
  crypto.getRandomValues(buf)
  let out = ""
  for (const b of buf) out += alphabet[b % alphabet.length]
  return out
}

/** `byteLen` random bytes as lowercase hex (length `2 * byteLen`). */
export function randomHex(byteLen: number): string {
  const buf = new Uint8Array(byteLen)
  crypto.getRandomValues(buf)
  return Array.from(buf, (x) => x.toString(16).padStart(2, "0")).join("")
}
