import {
  Database,
  JwtIssuer,
  OutboxWriter,
  ServiceTokenIssuer,
  newUserVerifier,
  parseClients,
  parseEd25519Seed,
} from "@iedora/server-kit";
import { type ScratchDatabase, createScratchDatabase } from "@iedora/server-kit/testkit";
import { afterAll, beforeAll, expect, test } from "bun:test";

import { buildApp } from "../src/app";
import type { AuthConfig } from "../src/config";
import type { AuthDB } from "../src/schema";

const SEED = "4qiWAUBUtlk6abEM+o0urqz3tGcSVjg8f/NyRa5wWeI=";

let scratch: ScratchDatabase;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: Database<any>;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  scratch = await createScratchDatabase({
    prefix: "auth_test",
    migrationsDir: `${import.meta.dir}/../migrations`,
  });
  const url = scratch.url;

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
    serviceClients: "admin-bff:dev-secret",
    serviceAudience: "iedora-internal",
    serviceTokenTtl: "10m",
    serviceTokenTtlMs: 10 * 6e4,
  };
  const keys = parseEd25519Seed(SEED);
  app = buildApp({
    db,
    issuer: new JwtIssuer({ keys, kid: "k1", issuer: cfg.jwtIssuer, audience: cfg.jwtAudience, accessTtl: cfg.accessTtl }),
    userVerifier: newUserVerifier(keys.publicKey, cfg.jwtIssuer, cfg.jwtAudience),
    serviceIssuer: new ServiceTokenIssuer({ privateKey: keys.privateKey, kid: "k1", issuer: cfg.jwtIssuer, audience: cfg.serviceAudience, ttl: cfg.serviceTokenTtl }),
    serviceClients: parseClients(cfg.serviceClients),
    auditor: new OutboxWriter(db, "auth"),
    cfg,
  });
});

afterAll(async () => {
  await db?.close();
  await scratch?.drop();
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

test("client-credentials token endpoint mints a service token (and rejects bad secrets)", async () => {
  const basic = (id: string, secret: string) =>
    `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
  const ok = await app.request("/auth/token", { method: "POST", headers: { authorization: basic("admin-bff", "dev-secret") } });
  expect(ok.status).toBe(200);
  const body = (await ok.json()) as { accessToken: string; tokenType: string };
  expect(body.tokenType).toBe("Bearer");
  expect(body.accessToken).toBeTruthy();

  const bad = await app.request("/auth/token", { method: "POST", headers: { authorization: basic("admin-bff", "wrong") } });
  expect(bad.status).toBe(401);
});

test("tenants: create a tenant, then refresh picks up the tid; whoami reflects identity", async () => {
  const reg = await app.request("/auth/register", json({ email: "b@iedora.com", password: "correct horse battery staple", name: "B" }));
  const access = ((await reg.json()) as { accessToken: string }).accessToken;
  const cookie = refreshCookie(reg)!;
  const bearer = { headers: { authorization: `Bearer ${access}` } };

  // whoami before any tenant
  const who = await app.request("/auth/whoami", bearer);
  expect(who.status).toBe(200);
  expect(((await who.json()) as { tenantId?: string }).tenantId).toBeUndefined();

  // create a tenant (caller becomes owner)
  const created = await app.request("/auth/tenants", { method: "POST", headers: { authorization: `Bearer ${access}`, "content-type": "application/json" }, body: JSON.stringify({ name: "Acme" }) });
  expect(created.status).toBe(200);
  expect(((await created.json()) as { name: string }).name).toBe("Acme");

  // refresh now mints a tenant-scoped token (the onboarding flow)
  const refreshed = await app.request("/auth/refresh", { method: "POST", headers: { cookie: `iedora_refresh=${cookie}` } });
  expect(refreshed.status).toBe(200);
  expect(((await refreshed.json()) as { tenantId?: string }).tenantId).toBeTruthy();
});

test("logout-all revokes every device session", async () => {
  const reg = await app.request("/auth/register", json({ email: "c@iedora.com", password: "correct horse battery staple", name: "C" }));
  const access = ((await reg.json()) as { accessToken: string }).accessToken;
  const cookie = refreshCookie(reg)!;
  const res = await app.request("/auth/logout-all", { method: "POST", headers: { authorization: `Bearer ${access}` } });
  expect(res.status).toBe(200);
  expect((await app.request("/auth/refresh", { method: "POST", headers: { cookie: `iedora_refresh=${cookie}` } })).status).toBe(401);
});

test("JWKS serves the EdDSA public key", async () => {
  const res = await app.request("/auth/.well-known/jwks.json");
  expect(res.status).toBe(200);
  const body = (await res.json()) as { keys: { kty: string; crv: string }[] };
  expect(body.keys[0]!.kty).toBe("OKP");
  expect(body.keys[0]!.crv).toBe("Ed25519");
});
