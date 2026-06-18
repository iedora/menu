import { auditFilter } from "@iedora/contracts";
import { type ServiceEnv, serviceAuth } from "@iedora/server-kit";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import type { AuditDeps } from "../../deps";
import { queryAudit } from "./events.query";

// Vertical slice: querying the audit log. Owns its route, its request
// validation (the shared zod contract, via @hono/zod-validator), and its data
// access (events.query). Mounted at /obs by the app composition root.
export function eventsRoutes(deps: AuditDeps) {
  return new Hono<ServiceEnv>().get(
    "/events",
    serviceAuth(deps.verifier),
    zValidator("query", auditFilter),
    async (c) => c.json(await queryAudit(deps.database.db, c.req.valid("query"))),
  );
}
