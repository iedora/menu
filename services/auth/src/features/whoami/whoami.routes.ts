import { type UserEnv, userAuth } from "@iedora/menu-kit";
import { Hono } from "hono";

import { findUserById } from "../../data/users";
import type { AuthDeps } from "../../deps";

// The signed-in user's identity. Mostly decoded from the access token, but
// `mustChangePassword` is read LIVE from the DB so the dashboard guard stops
// redirecting the instant the user completes a forced change (the token claim
// would lag).
export function whoamiRoutes(deps: AuthDeps) {
  return new Hono<UserEnv>().get("/whoami", userAuth(deps.userVerifier), async (c) => {
    const u = c.get("user");
    const row = await findUserById(deps.db.db, u.userId);
    return c.json({
      userId: u.userId,
      tenantId: u.org,
      roles: u.roles,
      email: u.email,
      mustChangePassword: row?.must_change_password ?? false,
    });
  });
}
