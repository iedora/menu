import type { Database } from "@iedora/server-kit";

import type { MenuConfig } from "./config";
import type { Limiter } from "./ratelimit";
import type { MenuDB } from "./schema";

// Cross-slice dependencies wired once at boot. The authenticated surface
// (service/user verifier, auditor, plan gate) is added in Stage B.
export interface MenuDeps {
  db: Database<MenuDB>;
  limiter: Limiter;
  cfg: MenuConfig;
}
