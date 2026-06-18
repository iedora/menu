import { createServiceApp } from "@iedora/server-kit";

import type { MenuDeps } from "./deps";
import { handleError } from "./errors";
import { publicRoutes } from "./features/public/public.routes";

// Composition root: the public surface under /public + /up. The authenticated
// /api and /staff surfaces arrive in Stage B/C. onError is overridden with the
// menu handler so a malformed-uuid path param surfaces as 404 (like missing),
// matching the Go respond() chokepoint.
export function buildApp(deps: MenuDeps) {
  const app = createServiceApp()
    .get("/up", async (c) => {
      try {
        await deps.db.ping();
        return c.json({ ok: true });
      } catch {
        return c.json({ ok: false }, 503);
      }
    })
    .route("/public", publicRoutes(deps));

  app.onError(handleError);
  return app;
}

export type MenuApp = ReturnType<typeof buildApp>;
