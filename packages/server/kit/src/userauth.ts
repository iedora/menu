import type { KeyObject } from "node:crypto";

import { createMiddleware } from "hono/factory";
import { type CryptoKey, jwtVerify } from "jose";

// Verifies USER access tokens (EdDSA) — ports Go internal/userauth. Used by
// product services (menu, admin) and auth's own authenticated routes. Algorithm
// pinned; iss/aud checked; the typ=="access" guard rejects refresh/service tokens.

export interface UserPrincipal {
  userId: string;
  tenantId?: string;
  roles: string[];
  email?: string;
}

export interface UserVerifier {
  key: CryptoKey | Uint8Array | KeyObject;
  issuer: string;
  audience: string;
}

export interface UserEnv {
  Variables: { user: UserPrincipal };
}

export function newUserVerifier(
  key: CryptoKey | Uint8Array | KeyObject,
  issuer: string,
  audience: string,
): UserVerifier {
  return { key, issuer, audience };
}

export async function verifyAccessToken(v: UserVerifier, token: string): Promise<UserPrincipal> {
  const { payload } = await jwtVerify(token, v.key, {
    issuer: v.issuer,
    audience: v.audience,
    algorithms: ["EdDSA"],
  });
  if (payload.typ !== "access") throw new Error("not an access token");
  if (!payload.sub) throw new Error("access token missing subject");
  return {
    userId: payload.sub,
    tenantId: typeof payload.tid === "string" ? payload.tid : undefined,
    roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}

/** Hono middleware: 401 unless a valid user access token is present; sets `user`. */
export function userAuth(v: UserVerifier) {
  return createMiddleware<UserEnv>(async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return c.json({ error: "missing bearer token" }, 401);
    try {
      c.set("user", await verifyAccessToken(v, token));
    } catch {
      return c.json({ error: "invalid access token" }, 401);
    }
    await next();
  });
}

/** True if the principal carries one of the required roles (port of authz checks). */
export function hasRole(p: UserPrincipal, ...roles: string[]): boolean {
  return p.roles.some((r) => roles.includes(r));
}
