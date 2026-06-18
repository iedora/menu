import { Database, OutboxWriter, parseEd25519Seed, JwtIssuer, runMigrations } from "@iedora/server-kit";
import { SQL } from "bun";
import { afterAll, beforeAll, expect, test } from "bun:test";

import { buildApp } from "../src/app";
import type { AuthConfig } from "../src/config";
import type { AuthDB } from "../src/schema";

const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://iedora:iedora@localhost:55433/postgres";
const SEED = "4qiWAUBUtlk6abEM+o0urqz3tGcSVjg8f/NyRa5wWeI=";
const scratch = `auth_test_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

function urlFor(db: string): string {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${db}`;
  return u.toString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: Database<any>;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  const admin = new SQL(ADMIN_URL);
  await admin.unsafe(`CREATE DATABASE "${scratch}"`);
  await admin.end();
  const url = urlFor(scratch);
  await runMigrations({ url, dir: `${import.meta.dir}/../migrations` });

  db = new Database<AuthDB>(url);
  const cfg: AuthConfig = {
    port: 0,
    authDatabaseUrl: url,
    auditDatabaseUrl: url, // audit events queue in this DB's outbox (relay not run here)
    jwtSeed: SEED,
    jwtKeyId: "k1",
    jwtIssuer: "https://api.iedora.com",
    jwtAudience: "iedora-api",
    accessTtl: "15m",
    accessTtlMs: 15 * 6e4,
    refreshTtlMs: 30 * 864e5,
    refreshAbsoluteTtlMs: 90 * 864e5,
    refreshCookieName: "iedora_refresh",
    cookieDomain: "",
    cookieSecure: false,
    serviceClients: "",
    serviceAudience: "iedora-internal",
    serviceTokenTtl: "10m",
  };
  app = buildApp({ db, issuer: new JwtIssuer({ keys: parseEd25519Seed(SEED), kid: "k1", issuer: cfg.jwtIssuer, audience: cfg.jwtAudience, accessTtl: cfg.accessTtl }), auditor: new OutboxWriter(db, "auth"), cfg });
});

afterAll(async () => {
  await db?.close();
  const admin = new SQL(ADMIN_URL);
  await admin.unsafe(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [scratch]).catch(() => {});
  await admin.unsafe(`DROP DATABASE IF EXISTS "${scratch}"`).catch(() => {});
  await admin.end();
});

/** Extracts the iedora_refresh cookie value from a response's Set-Cookie. */
function refreshCookie(res: Response): string | undefined {
  for (const c of res.headers.getSetCookie()) {
    if (c.startsWith("iedora_refresh=")) return c.slice("iedora_refresh=".length).split(";")[0];
  }
  return undefined;
}

const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const withCookie = (token: string) => ({ method: "POST", headers: { cookie: `iedora_refresh=${token}` } });

const creds = { email: "a@iedora.com", password: "correct horse battery staple", name: "A" };

test("register issues tokens + a refresh cookie", async () => {
  const res = await app.request("/auth/register", json(creds));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { accessToken: string; userId: string };
  expect(body.accessToken).toBeTruthy();
  expect(body.userId).toBeTruthy();
  expect(refreshCookie(res)).toBeTruthy();
});

test("duplicate email is rejected (409)", async () => {
  expect((await app.request("/auth/register", json(creds))).status).toBe(409);
});

test("login + refresh rotate the token; the old token is reuse-detected", async () => {
  const loginRes = await app.request("/auth/login", json({ email: creds.email, password: creds.password }));
  expect(loginRes.status).toBe(200);
  const c1 = refreshCookie(loginRes)!;
  expect(c1).toBeTruthy();

  const r1 = await app.request("/auth/refresh", withCookie(c1));
  expect(r1.status).toBe(200);
  const c2 = refreshCookie(r1)!;
  expect(c2).toBeTruthy();
  expect(c2).not.toBe(c1);

  // Replaying the now-rotated first token → reuse detected → 401.
  expect((await app.request("/auth/refresh", withCookie(c1))).status).toBe(401);
  // …and the family is burned, so the successor is dead too.
  expect((await app.request("/auth/refresh", withCookie(c2))).status).toBe(401);
});

test("bad password is 401", async () => {
  expect((await app.request("/auth/login", json({ email: creds.email, password: "nope" }))).status).toBe(401);
});

test("logout revokes the session", async () => {
  const loginRes = await app.request("/auth/login", json({ email: creds.email, password: creds.password }));
  const c = refreshCookie(loginRes)!;
  expect((await app.request("/auth/logout", withCookie(c))).status).toBe(200);
  expect((await app.request("/auth/refresh", withCookie(c))).status).toBe(401);
});

test("JWKS serves the EdDSA public key", async () => {
  const res = await app.request("/auth/.well-known/jwks.json");
  expect(res.status).toBe(200);
  const body = (await res.json()) as { keys: { kty: string; crv: string }[] };
  expect(body.keys[0]!.kty).toBe("OKP");
  expect(body.keys[0]!.crv).toBe("Ed25519");
});
