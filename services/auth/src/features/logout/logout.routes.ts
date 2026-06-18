import { Hono } from "hono";
import { getCookie } from "hono/cookie";

import type { AuthDeps } from "../../deps";
import { clearRefreshCookie, metaFrom } from "../../session";
import { logout } from "./logout.service";

export function logoutRoutes(deps: AuthDeps) {
  return new Hono().post("/logout", async (c) => {
    const token = getCookie(c, deps.cfg.refreshCookieName);
    if (token) await logout(deps, token, metaFrom(c));
    clearRefreshCookie(c, deps.cfg);
    return c.json({ ok: true });
  });
}
