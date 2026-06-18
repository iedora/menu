import { type UserEnv, userAuth } from "@iedora/server-kit";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";

import type { AuthDeps } from "../../deps";
import { clearRefreshCookie, metaFrom } from "../../session";
import { logout, logoutAll } from "./logout.service";

export function logoutRoutes(deps: AuthDeps) {
  return new Hono<UserEnv>()
    .post("/logout", async (c) => {
      const token = getCookie(c, deps.cfg.refreshCookieName);
      if (token) await logout(deps, token, metaFrom(c));
      clearRefreshCookie(c, deps.cfg);
      return c.json({ ok: true });
    })
    .post("/logout-all", userAuth(deps.userVerifier), async (c) => {
      await logoutAll(deps, c.get("user").userId, metaFrom(c));
      clearRefreshCookie(c, deps.cfg);
      return c.json({ ok: true });
    });
}
