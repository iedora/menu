import { type ServiceEnv, serviceAuth } from "@iedora/menu-kit";
import { Hono } from "hono";
import { z } from "zod";

import type { BillingDeps } from "../../deps";
import { createCharge, fetchCharge } from "./charge.service";

// Vertical slice: the generic charge. POST creates one through the wired gateway;
// GET reads it back. Body is validated in-handler (not via zValidator middleware)
// to keep Hono's RPC type from exploding on the optional record field.
const chargeRequest = z.object({
  product: z.string().min(1),
  payer: z.string().min(1),
  payee: z.string().min(1).optional(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  feeRate: z.number().min(0).max(1).optional(),
  customer: z.string().optional(),
  paymentMethod: z.string().optional(),
  offSession: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export function chargeRoutes(deps: BillingDeps) {
  return new Hono<ServiceEnv>()
    .post("/charges", serviceAuth(deps.verifier), async (c) => {
      const parsed = chargeRequest.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
      return c.json(await createCharge(deps, parsed.data, c.get("clientId")));
    })
    .get("/charges/:id", serviceAuth(deps.verifier), async (c) => {
      const charge = await fetchCharge(deps, c.req.param("id"));
      return charge ? c.json(charge) : c.json({ error: "not_found" }, 404);
    });
}
