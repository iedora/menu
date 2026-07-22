// Physical QR sticker code helpers. Codes are a
// cross-tenant registry; the store side (resolve/admin) lives in data/qr.ts.
import { randomString } from "@iedora/common";

// Codes use the unambiguous base32 alphabet (no 0/O, 1/I/L, U) so they survive
// being read aloud or retyped from a sticker.
const GENERATED_QR_LEN = 8;
const qrPattern = /^[a-z0-9_-]{1,64}$/;

/** Canonicalizes operator input. */
export function normalizeQRCode(raw: string): string {
  return raw.trim().toLowerCase();
}

/** True if a normalized code has an acceptable shape. */
export function validQRCode(code: string): boolean {
  return qrPattern.test(code);
}

// Mints a random sticker code (~39 bits; the PK uniqueness check is the final
// guard against the astronomically rare collision).
export function generateQRCode(): string {
  return randomString(GENERATED_QR_LEN);
}
