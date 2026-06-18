import { forgotPasswordRequest, resetPasswordRequest } from "@iedora/contracts";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import type { AuthDeps } from "../../deps";
import { metaFrom } from "../../session";
import { confirmReset, requestReset } from "./password-reset.service";

export function passwordResetRoutes(deps: AuthDeps) {
  return new Hono()
    // Forgot: ALWAYS 200 with a fixed body, existence aside — no enumeration.
    .post("/forgot-password", zValidator("json", forgotPasswordRequest), async (c) => {
      await requestReset(deps, c.req.valid("json").email, metaFrom(c));
      return c.json({ ok: true });
    })
    // Confirm: 200 on success (no tokens/cookie — no auto-login), 400 on a bad
    // or expired token. Referrer-Policy avoids leaking the token via Referer if
    // the page makes onward requests.
    .post("/reset-password", zValidator("json", resetPasswordRequest), async (c) => {
      await confirmReset(deps, c.req.valid("json"), metaFrom(c));
      c.header("Referrer-Policy", "no-referrer");
      return c.json({ ok: true });
    });
}
