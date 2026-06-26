import type { KeyObject } from "node:crypto";

import { type CryptoKey, importJWK, jwtVerify, SignJWT } from "jose";

import { bearerAuth, type ServiceEnv } from "./http";

// Verifies the internal service tokens minted by the auth service (EdDSA):
// algorithm pinned to EdDSA (algorithm-confusion defense), issuer + audience
// checked, and the `typ=="service"` guard so a user token can't be replayed here.

export interface ServiceVerifier {
  key: CryptoKey | Uint8Array | KeyObject;
  issuer: string;
  audience: string;
}

/**
 * Imports the shared Ed25519 public key. Accepts the base64 (std) raw
 * 32-byte key in SERVICE_JWT_PUBLIC_KEY.
 */
export async function parseEd25519PublicKey(base64Std: string): Promise<CryptoKey | Uint8Array> {
  const raw = Buffer.from(base64Std, "base64");
  const x = Buffer.from(raw).toString("base64url");
  return importJWK({ kty: "OKP", crv: "Ed25519", x, alg: "EdDSA" }, "EdDSA");
}

export function newServiceVerifier(
  key: CryptoKey | Uint8Array | KeyObject,
  issuer: string,
  audience: string,
): ServiceVerifier {
  return { key, issuer, audience };
}

/** Verifies a service token and returns the client id (sub). Throws on failure. */
export async function verifyServiceToken(v: ServiceVerifier, token: string): Promise<string> {
  const { payload } = await jwtVerify(token, v.key, {
    issuer: v.issuer,
    audience: v.audience,
    algorithms: ["EdDSA"],
  });
  if (payload.typ !== "service") throw new Error("not a service token");
  if (!payload.sub) throw new Error("service token missing subject");
  return payload.sub;
}

export interface ServiceIssuerConfig {
  privateKey: CryptoKey | KeyObject;
  kid: string;
  issuer: string;
  audience: string;
  ttl?: string | number; // jose duration; default "10m"
}

// Mints internal service tokens (EdDSA, typ="service") for the client-
// credentials grant.
export class ServiceTokenIssuer {
  constructor(private readonly cfg: ServiceIssuerConfig) {}

  issue(clientId: string): Promise<string> {
    return new SignJWT({ typ: "service" })
      .setProtectedHeader({ alg: "EdDSA", kid: this.cfg.kid })
      .setSubject(clientId)
      .setIssuer(this.cfg.issuer)
      .setAudience(this.cfg.audience)
      .setIssuedAt()
      .setExpirationTime(this.cfg.ttl ?? "10m")
      .sign(this.cfg.privateKey);
  }
}

/** Parses the "id1:secret1,id2:secret2" client registry (port of ParseClients). */
export function parseClients(s: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const pair of s.split(",")) {
    const [id, secret] = pair.split(":");
    if (id?.trim() && secret?.trim()) m.set(id.trim(), secret.trim());
  }
  return m;
}

/** Hono middleware: 401 unless a valid service bearer token is present; sets `clientId`. */
export function serviceAuth(v: ServiceVerifier) {
  return bearerAuth<ServiceEnv>({
    verify: (token) => verifyServiceToken(v, token),
    setKey: "clientId",
    invalidMsg: "invalid service token",
  });
}
