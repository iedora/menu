import { expandFileSecrets, env, serve } from "@iedora/server-kit";

import { buildApp } from "./app";

expandFileSecrets();

serve(buildApp(), {
  name: "iedora-audit",
  port: Number(env("AUDIT_PORT", "8081")),
});
