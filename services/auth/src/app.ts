import { createServiceApp } from "@iedora/server-kit";
import { Hono } from "hono";

import type { AuthDeps } from "./deps";
import { jwksRoutes } from "./features/jwks/jwks.routes";
import { loginRoutes } from "./features/login/login.routes";
import { logoutRoutes } from "./features/logout/logout.routes";
import { refreshRoutes } from "./features/refresh/refresh.routes";
import { registerRoutes } from "./features/register/register.routes";

// Composition root: mount each auth slice under /auth. Slices own their own
// logic (features/<slice>/); this only wires + exposes /up.
export function buildApp(deps: AuthDeps) {
  const auth = new Hono()
    .route("/", registerRoutes(deps))
    .route("/", loginRoutes(deps))
    .route("/", refreshRoutes(deps))
    .route("/", logoutRoutes(deps))
    .route("/", jwksRoutes(deps));

  return createServiceApp()
    .get("/up", async (c) => {
      try {
        await deps.db.ping();
        return c.json({ ok: true });
      } catch {
        return c.json({ ok: false }, 503);
      }
    })
    .route("/auth", auth);
}

export type AuthApp = ReturnType<typeof buildApp>;
