import { Hono } from "hono";

// buildApp constructs the audit service's Hono app. It's exported (and its type
// re-exported as AuditApp) so the admin BFF and frontend can derive a typed
// Hono RPC client from it.
//
// Phase 0: a bare /up health route (walking skeleton).
// Phase 1 mounts GET /obs/events (service-token auth + the Kysely keyset query
// over audit_log) onto this app.
export function buildApp() {
  const app = new Hono();
  app.get("/up", (c) => c.json({ ok: true }));
  return app;
}

export type AuditApp = ReturnType<typeof buildApp>;
