import { env, isProd, requireEnv } from "@iedora/server-kit";

// Parses a Go-style duration ("15m", "720h", "30d") into milliseconds.
function durationMs(s: string, fallbackMs: number): number {
  const m = /^(\d+)(ms|s|m|h|d)$/.exec(s.trim());
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const unit: Record<string, number> = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5 };
  return n * unit[m[2]!]!;
}

export interface AuthConfig {
  port: number;
  authDatabaseUrl: string;
  auditDatabaseUrl: string;
  jwtSeed: string;
  jwtKeyId: string;
  jwtIssuer: string;
  jwtAudience: string;
  accessTtl: string; // jose duration for the access token (the JWT exp)
  accessTtlMs: number; // same, in ms, for the response's informational expiresAt
  refreshTtlMs: number; // sliding refresh lifetime
  refreshAbsoluteTtlMs: number; // hard cap from first login
  refreshCookieName: string;
  cookieDomain: string;
  cookieSecure: boolean;
  serviceClients: string; // "id:secret,id2:secret2"
  serviceAudience: string;
  serviceTokenTtl: string;
}

// Mirrors the Go auth Config (internal/apps/auth/config.go). All vars match the
// existing names so the prod env/secrets carry over unchanged at cutover.
export function loadConfig(): AuthConfig {
  return {
    port: Number(env("AUTH_PORT", "8080")),
    authDatabaseUrl: requireEnv("AUTH_DATABASE_URL"),
    auditDatabaseUrl: requireEnv("AUDIT_DATABASE_URL"),
    jwtSeed: requireEnv("API_JWT_PRIVATE_KEY"),
    jwtKeyId: env("API_JWT_KEY_ID", "k1"),
    jwtIssuer: requireEnv("API_JWT_ISSUER"),
    jwtAudience: env("API_JWT_AUDIENCE", "iedora-api"),
    accessTtl: env("API_ACCESS_TTL", "15m"),
    accessTtlMs: durationMs(env("API_ACCESS_TTL", "15m"), 15 * 6e4),
    refreshTtlMs: durationMs(env("API_REFRESH_TTL", "720h"), 720 * 36e5),
    refreshAbsoluteTtlMs: durationMs(env("API_REFRESH_ABSOLUTE_TTL", "2160h"), 2160 * 36e5),
    refreshCookieName: env("API_REFRESH_COOKIE_NAME", "iedora_refresh"),
    cookieDomain: env("API_COOKIE_DOMAIN", ""),
    cookieSecure: isProd(),
    serviceClients: env("SERVICE_CLIENTS", ""),
    serviceAudience: env("SERVICE_AUDIENCE", "iedora-internal"),
    serviceTokenTtl: env("SERVICE_TOKEN_TTL", "10m"),
  };
}
