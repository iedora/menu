import { Hono } from "hono";

import type { AuthDeps } from "../../deps";

// Serves the EdDSA public key set so callees (frontend, menu, admin) can verify
// access tokens. Public, cacheable.
export function jwksRoutes(deps: AuthDeps) {
  return new Hono().get("/.well-known/jwks.json", (c) => {
    c.header("cache-control", "public, max-age=300");
    return c.json(deps.issuer.jwks());
  });
}
