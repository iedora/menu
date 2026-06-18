import { registerRequest } from "@iedora/contracts";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import type { AuthDeps } from "../../deps";
import { metaFrom, setRefreshCookie, tokenJson } from "../../session";
import { register } from "./register.service";

export function registerRoutes(deps: AuthDeps) {
  return new Hono().post("/register", zValidator("json", registerRequest), async (c) => {
    const tokens = await register(deps, c.req.valid("json"), metaFrom(c));
    setRefreshCookie(c, deps.cfg, tokens.refreshToken, tokens.refreshExpiresAt);
    return c.json(tokenJson(tokens));
  });
}
