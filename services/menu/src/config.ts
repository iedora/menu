import { env, requireEnv } from "@iedora/server-kit";

export interface MenuConfig {
  port: number;
  menuDatabaseUrl: string;
  rateLimitDisabled: boolean; // CI/e2e escape hatch
}

// Mirrors the Go menu Config (internal/apps/menu/config.go). Var names match the
// existing prod env/secrets so they carry over unchanged at cutover. The
// authenticated-surface vars (verifier key, billing client) arrive in Stage B.
export function loadConfig(): MenuConfig {
  return {
    port: Number(env("MENU_PORT", "8084")),
    menuDatabaseUrl: requireEnv("MENU_DATABASE_URL"),
    rateLimitDisabled: env("DISABLE_RATE_LIMIT", "") !== "",
  };
}
