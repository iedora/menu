import { env, requireEnv } from "@iedora/server-kit";

export interface MenuConfig {
  port: number;
  menuDatabaseUrl: string;
  auditDatabaseUrl: string; // audit DB the outbox relay drains into
  rateLimitDisabled: boolean; // CI/e2e escape hatch

  // Verifies dashboard USER access tokens (the same Ed25519 key auth signs with;
  // its public half is shared as SERVICE_JWT_PUBLIC_KEY across the services).
  apiJwtPublicKey: string; // base64 std raw Ed25519
  apiJwtIssuer: string;
  apiJwtAudience: string;

  // Billing lookup for plan gates (client-credentials service token via auth).
  authBaseUrl: string;
  billingBaseUrl: string;
  serviceClientId: string;
  serviceClientSecret: string;
}

// Mirrors the Go menu Config (internal/apps/menu/config.go). Var names match the
// existing prod env/secrets so they carry over unchanged at cutover.
export function loadConfig(): MenuConfig {
  return {
    port: Number(env("MENU_PORT", "8084")),
    menuDatabaseUrl: requireEnv("MENU_DATABASE_URL"),
    auditDatabaseUrl: requireEnv("AUDIT_DATABASE_URL"),
    rateLimitDisabled: env("DISABLE_RATE_LIMIT", "") !== "",
    apiJwtPublicKey: requireEnv("API_JWT_PUBLIC_KEY"),
    apiJwtIssuer: requireEnv("API_JWT_ISSUER"),
    apiJwtAudience: env("API_JWT_AUDIENCE", "iedora-api"),
    authBaseUrl: env("AUTH_BASE_URL", "http://localhost:8080"),
    billingBaseUrl: env("BILLING_BASE_URL", "http://localhost:8083"),
    serviceClientId: requireEnv("SERVICE_CLIENT_ID"),
    serviceClientSecret: requireEnv("SERVICE_CLIENT_SECRET"),
  };
}
