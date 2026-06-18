import { Database, expandFileSecrets, serve } from "@iedora/server-kit";

import { buildApp } from "./app";
import { loadConfig } from "./config";
import { Limiter } from "./ratelimit";
import type { MenuDB } from "./schema";

expandFileSecrets();
const cfg = loadConfig();

const db = new Database<MenuDB>(cfg.menuDatabaseUrl);
const limiter = new Limiter(db, cfg.rateLimitDisabled);

serve(buildApp({ db, limiter, cfg }), {
  name: "iedora-menu",
  port: cfg.port,
  onShutdown: async () => {
    await db.close();
  },
});
