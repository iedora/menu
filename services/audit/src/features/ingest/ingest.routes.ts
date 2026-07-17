import { createAuditReceiver, type ServiceEnv, serviceAuth } from "@iedora/menu-kit";
import { Hono } from "hono";
import { z } from "zod";

import type { AuditDeps } from "../../deps";

// Vertical slice: INGESTING audit events. Producers no longer write audit_log
// through the DB (hard rule: services never communicate through the database) —
// each producer's outbox relay POSTs its events here over a service token, and
// this slice records them into the audit service's OWN schema, deduped by the
// producer's outbox message id so at-least-once redelivery records once.
const ingestBody = z.object({
  events: z
    .array(
      z.object({
        messageId: z.string().min(1),
        payload: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1),
});

export function ingestRoutes(deps: AuditDeps) {
  // Built once over the audit service's own pool; opens its own tx per event.
  const receive = createAuditReceiver(deps.database.root);
  // Body is validated in-handler (not via zValidator middleware): this route has
  // no typed RPC client, and threading the array/record schema through Hono's
  // generics blows the type instantiation depth.
  return new Hono<ServiceEnv>().post("/events", serviceAuth(deps.verifier), async (c) => {
    const parsed = ingestBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
    for (const e of parsed.data.events) await receive(e);
    return c.json({ ok: true, count: parsed.data.events.length });
  });
}
