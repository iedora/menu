import { timingSafeEqual } from "node:crypto";

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AuthDeps } from "../../deps";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Client-credentials grant: HTTP Basic clientId:secret → an internal service
// token (typ="service", aud=internal). Ports service-auth TokenHandler.
export function tokenRoutes(deps: AuthDeps) {
  return new Hono().post("/token", async (c) => {
    const header = c.req.header("authorization") ?? "";
    if (!header.startsWith("Basic ")) {
      throw new HTTPException(401, { message: "basic auth required" });
    }
    const [clientId, secret] = Buffer.from(header.slice(6), "base64").toString("utf8").split(":");
    const expected = clientId ? deps.serviceClients.get(clientId) : undefined;
    if (!clientId || !secret || !expected || !safeEqual(secret, expected)) {
      throw new HTTPException(401, { message: "invalid client credentials" });
    }
    const accessToken = await deps.serviceIssuer.issue(clientId);
    return c.json({
      accessToken,
      expiresAt: new Date(Date.now() + deps.cfg.serviceTokenTtlMs).toISOString(),
      tokenType: "Bearer" as const,
    });
  });
}
