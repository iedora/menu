import { type UserEnv, userAuth } from "@iedora/server-kit";
import { Hono } from "hono";

import type { AuthDeps } from "../../deps";

// The signed-in user's identity (decoded from their access token).
export function whoamiRoutes(deps: AuthDeps) {
  return new Hono<UserEnv>().get("/whoami", userAuth(deps.userVerifier), (c) => {
    const u = c.get("user");
    return c.json({ userId: u.userId, tenantId: u.tenantId, roles: u.roles, email: u.email });
  });
}
