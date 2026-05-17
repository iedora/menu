/**
 * Application-layer encryption-at-rest for webhook secrets (and any other
 * secret-shaped column that doesn't need to be searchable). The envelope is
 * self-describing so a future KMS-backed encryptor can ship `v2` envelopes
 * alongside `v1` ones and the decryptor branches on the version byte — no
 * data migration required.
 *
 * Envelope wire format:
 *   iedora/v1:<base64url(iv || ciphertext || tag)>
 *
 *   - "iedora/" magic prefix: distinguishes encrypted values from plaintext
 *     (legacy rows pre-migration) so we can do lazy migration without a
 *     hard cutover.
 *   - "v1": format version. v2 ships when we move to a KMS-managed key
 *     (envelope-encryption with a per-row DEK wrapped by a KMS KEK).
 *   - iv: 12 bytes, the AES-GCM standard nonce size. NIST SP 800-38D
 *     recommends 96-bit IVs for GCM specifically because they hit the GCM
 *     internals on a fast path (no extra GHASH pass) and the random-IV
 *     birthday bound is comfortably above realistic write volumes for a
 *     webhook table.
 *   - ciphertext: variable length, AES-256-GCM output.
 *   - tag: 16 bytes, the GCM auth tag.
 *
 * Key derivation:
 *   HKDF-SHA256 over BETTER_AUTH_SECRET → 32-byte AES-256 key.
 *   salt = "iedora/webhook-secret-v1"
 *   info = "encrypt"
 *
 *   This piggy-backs on BETTER_AUTH_SECRET intentionally — one less env
 *   var to manage in BWS, and HKDF's purpose-separation (different
 *   salt/info → cryptographically independent output) gives the domain
 *   separation that a dedicated env var would. Both keys would live in
 *   `process.env` anyway, so compromise of either leaks the other.
 *
 *   TODO(soc2-followup): when an external customer arrives, swap this for
 *   a KMS-managed KEK + per-row DEK pattern. The envelope's version byte
 *   already supports it — wire a new `createKmsEncryptor()` that emits
 *   `iedora/v2:…` and teach `decrypt` to branch on version.
 */

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const MAGIC_PREFIX = "iedora/";
const VERSION_V1 = "v1";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // AES-256

/** AES-256 requires a 32-byte key, so the master input must be at least that long. */
const MIN_MASTER_KEY_BYTES = 32;

const HKDF_SALTS = {
  v1: "iedora/webhook-secret-v1",
} as const;
const HKDF_INFO = "encrypt";

export type SaltVersion = keyof typeof HKDF_SALTS;

export interface SecretEncryptor {
  /** Wrap a plaintext into the `iedora/v1:…` envelope. Sync; no I/O. */
  encrypt(plaintext: string): string;
  /** Reverse `encrypt`. Throws on tamper / wrong key / unsupported version. */
  decrypt(envelope: string): string;
  /** Cheap magic-prefix sniff — true iff the value carries the `iedora/` tag. */
  isEncrypted(value: string): boolean;
}

/**
 * Try to decode a master key as base64 first (Better Auth's `generate-secret`
 * emits base64). If decoding produces fewer than 32 raw bytes (or the input
 * isn't valid base64), fall back to interpreting the string as UTF-8 bytes.
 * Whichever interpretation yields ≥ 32 bytes wins.
 *
 * This matches Better Auth's own laxity: it accepts a base64-encoded secret
 * but also tolerates a hand-typed plain string.
 */
function decodeMasterKey(raw: string): Buffer {
  // base64 candidate
  try {
    const b64 = Buffer.from(raw, "base64");
    // Reject inputs where base64 round-trip silently truncates (e.g. a
    // 31-character pseudo-base64 string that decodes to 23 bytes). We
    // require the decoded length to be ≥ MIN_MASTER_KEY_BYTES.
    if (b64.length >= MIN_MASTER_KEY_BYTES) return b64;
  } catch {
    // fallthrough
  }
  return Buffer.from(raw, "utf8");
}

function deriveKey(masterKey: string, saltVersion: SaltVersion): Buffer {
  const decoded = decodeMasterKey(masterKey);
  if (decoded.length < MIN_MASTER_KEY_BYTES) {
    throw new Error(
      `secret-storage: master key too short (${decoded.length} bytes; need ≥ ${MIN_MASTER_KEY_BYTES})`,
    );
  }
  const salt = Buffer.from(HKDF_SALTS[saltVersion], "utf8");
  const info = Buffer.from(HKDF_INFO, "utf8");
  // `hkdfSync` returns an ArrayBuffer; wrap in Buffer for downstream APIs.
  const out = hkdfSync("sha256", decoded, salt, info, KEY_LENGTH);
  return Buffer.from(out);
}

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(s: string): Buffer {
  // Restore standard base64 padding before decoding.
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const normalized = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(normalized, "base64");
}

/**
 * Build an encryptor backed by an HKDF-derived AES-256-GCM key.
 *
 * Throws synchronously at construction time if the master input is too
 * short — we want this to fail fast at process start, not on the first
 * encrypt at request time.
 */
export function createHkdfEncryptor(opts: {
  masterKey?: string;
  saltVersion?: SaltVersion;
} = {}): SecretEncryptor {
  const masterKey =
    opts.masterKey !== undefined
      ? opts.masterKey
      : process.env.BETTER_AUTH_SECRET ?? "";
  const saltVersion: SaltVersion = opts.saltVersion ?? "v1";
  const key = deriveKey(masterKey, saltVersion);

  return {
    encrypt(plaintext: string): string {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ct = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      const payload = Buffer.concat([iv, ct, tag]);
      return `${MAGIC_PREFIX}${VERSION_V1}:${toBase64Url(payload)}`;
    },

    decrypt(envelope: string): string {
      if (typeof envelope !== "string" || !envelope.startsWith(MAGIC_PREFIX)) {
        throw new Error("secret-storage: not an iedora envelope");
      }
      const colon = envelope.indexOf(":");
      if (colon < 0) throw new Error("secret-storage: malformed envelope");
      const version = envelope.slice(MAGIC_PREFIX.length, colon);
      const body = envelope.slice(colon + 1);
      if (version !== VERSION_V1) {
        throw new Error(`secret-storage: unsupported envelope version "${version}"`);
      }
      const payload = fromBase64Url(body);
      if (payload.length < IV_LENGTH + TAG_LENGTH) {
        throw new Error("secret-storage: envelope payload too short");
      }
      const iv = payload.subarray(0, IV_LENGTH);
      const tag = payload.subarray(payload.length - TAG_LENGTH);
      const ct = payload.subarray(IV_LENGTH, payload.length - TAG_LENGTH);
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      // `decipher.final()` throws "Unsupported state or unable to
      // authenticate data" on a bad tag — we let that propagate. Callers
      // MUST treat a thrown decrypt as fatal for that row; never catch +
      // continue with empty plaintext.
      const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
      return pt.toString("utf8");
    },

    isEncrypted(value: string): boolean {
      return typeof value === "string" && value.startsWith(MAGIC_PREFIX);
    },
  };
}

/**
 * Singleton bound to `process.env.BETTER_AUTH_SECRET`. Lazy-initialized on
 * first method call so just importing the module is safe in environments
 * where the env var isn't set (build, tests that don't touch crypto).
 */
let cached: SecretEncryptor | null = null;
function lazy(): SecretEncryptor {
  if (cached === null) cached = createHkdfEncryptor();
  return cached;
}

export const secretStorage: SecretEncryptor = {
  encrypt: (p) => lazy().encrypt(p),
  decrypt: (e) => lazy().decrypt(e),
  isEncrypted: (v) => v.startsWith(MAGIC_PREFIX),
};
