import { Hono } from "hono";
import { getCookie } from "hono/cookie";

import type { AuthDeps } from "../../deps";
import { unauthorized } from "../../errors";
import { metaFrom, setRefreshCookie, tokenJson } from "../../session";
import { refresh } from "./refresh.service";

export function refreshRoutes(deps: AuthDeps) {
  return new Hono().post("/refresh", async (c) => {
    const token = getCookie(c, deps.cfg.refreshCookieName);
    if (!token) throw unauthorized("no refresh token");
    const tokens = await refresh(deps, token, metaFrom(c));
    setRefreshCookie(c, deps.cfg, tokens.refreshToken, tokens.refreshExpiresAt);
    return c.json(tokenJson(tokens));
  });
}
