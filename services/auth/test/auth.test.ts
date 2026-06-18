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

// Capturing mailer: lets the reset tests read the link that would have been sent.
const sentResets: { to: string; url: string }[] = [];
const sentChanged: string[] = [];
const testMailer = {
  async sendPasswordReset(to: string, url: string) {
    sentResets.push({ to, url });
  },
  async sendPasswordChanged(to: string) {
    sentChanged.push(to);
  },
};
/** Extracts the `token` query param from the most recent reset link. */
function lastResetToken(): string {
  const url = sentResets.at(-1)!.url;
  return new URL(url).searchParams.get("token")!;
}

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
    roleGrants: [{ role: "admin", match: ["admin@iedora.com"] }],
    resetTokenTtlMs: 30 * 6e4,
    resetThrottleMs: 0, // no throttle in tests so back-to-back requests issue tokens
    resetUrlBase: "https://menu.iedora.com/reset-password",
  };
  const keys = parseEd25519Seed(SEED);
  app = buildApp({
    db,
    issuer: new JwtIssuer({ keys, kid: "k1", issuer: cfg.jwtIssuer, audience: cfg.jwtAudience, accessTtl: cfg.accessTtl }),
    userVerifier: newUserVerifier(keys.publicKey, cfg.jwtIssuer, cfg.jwtAudience),
    serviceIssuer: new ServiceTokenIssuer({ privateKey: keys.privateKey, kid: "k1", issuer: cfg.jwtIssuer, audience: cfg.serviceAudience, ttl: cfg.serviceTokenTtl }),
    serviceClients: parseClients(cfg.serviceClients),
    auditor: new OutboxWriter(db, "auth"),
    resetMailer: testMailer,
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

/** Decodes a JWT's payload (no verification) to read its claims. */
function claims(jwt: string): { roles?: string[] } {
  const payload = jwt.split(".")[1]!;
  return JSON.parse(Buffer.from(payload, "base64url").toString());
}

test("role-grant hook: a ROLE_GRANTS address gets its role on register", async () => {
  const reg = await app.request(
    "/auth/register",
    json({ email: "admin@iedora.com", password: "correct horse battery staple", name: "Boss" }),
  );
  expect(reg.status).toBe(200);
  const access = ((await reg.json()) as { accessToken: string }).accessToken;
  expect(claims(access).roles).toContain("admin");
});

test("role-grant hook writes an auth.user.role_granted audit event", async () => {
  await app.request(
    "/auth/register",
    json({ email: "audited-admin@iedora.com", password: "correct horse battery staple", name: "Aud" }),
  );
  // Audit events queue in this DB's outbox (the relay isn't run in tests). Each
  // payload is a JSON envelope; find the role_granted event we just wrote.
  const rows = await db.db.selectFrom("outbox").select(["payload"]).execute();
  const events = rows.map(
    (r) => JSON.parse(Buffer.from(r.payload).toString("utf8")) as { action: string; meta?: { role?: string } },
  );
  const granted = events.find((e) => e.action === "auth.user.role_granted" && e.meta?.role === "admin");
  expect(granted).toBeTruthy();
});

test("role-grant hook: a non-matching address is NOT promoted, and the role persists across login", async () => {
  // A plain user stays role-less.
  const plainReg = await app.request(
    "/auth/register",
    json({ email: "plain@iedora.com", password: "correct horse battery staple", name: "Plain" }),
  );
  expect(claims(((await plainReg.json()) as { accessToken: string }).accessToken).roles ?? []).not.toContain("admin");

  // The admin (registered above) keeps the role when logging in fresh.
  const login = await app.request("/auth/login", json({ email: "admin@iedora.com", password: "correct horse battery staple" }));
  expect(login.status).toBe(200);
  expect(claims(((await login.json()) as { accessToken: string }).accessToken).roles).toContain("admin");
});

test("forgot-password returns an identical 200 whether or not the account exists (no enumeration)", async () => {
  const known = await app.request("/auth/forgot-password", json({ email: creds.email }));
  const unknown = await app.request("/auth/forgot-password", json({ email: "nobody@nowhere.test" }));
  expect(known.status).toBe(200);
  expect(unknown.status).toBe(200);
  expect(await known.text()).toBe(await unknown.text());
});

test("forgot-password never returns the token in the HTTP response", async () => {
  const res = await app.request("/auth/forgot-password", json({ email: creds.email }));
  const body = await res.text();
  expect(body).not.toContain("token");
  // a real link was produced for the mailer, but only out-of-band
  expect(sentResets.at(-1)!.to).toBe(creds.email);
  expect(sentResets.at(-1)!.url).toContain("menu.iedora.com/reset-password");
});

test("reset-password with a valid token changes the password, revokes sessions, and does NOT auto-login", async () => {
  // Open a live session, then run a full reset.
  const before = await app.request("/auth/login", json({ email: creds.email, password: creds.password }));
  const oldRefresh = refreshCookie(before)!;

  await app.request("/auth/forgot-password", json({ email: creds.email }));
  const token = lastResetToken();
  const newPassword = "a brand new correct horse";
  const reset = await app.request("/auth/reset-password", json({ token, password: newPassword }));

  expect(reset.status).toBe(200);
  // No auto-login: no access token in the body, no refresh cookie set.
  const resetBody = (await reset.json()) as { accessToken?: string };
  expect(resetBody.accessToken).toBeUndefined();
  expect(refreshCookie(reset)).toBeUndefined();
  // Referer leak guard.
  expect(reset.headers.get("referrer-policy")).toBe("no-referrer");
  // The pre-existing session was revoked (logged out everywhere).
  expect((await app.request("/auth/refresh", withCookie(oldRefresh))).status).toBe(401);
  // Old password no longer works; the new one does.
  expect((await app.request("/auth/login", json({ email: creds.email, password: creds.password }))).status).toBe(401);
  expect((await app.request("/auth/login", json({ email: creds.email, password: newPassword }))).status).toBe(200);
  // A "your password changed" notice was queued.
  expect(sentChanged).toContain(creds.email);
  // keep creds usable for later tests
  creds.password = newPassword;
});

test("a reset token is single-use", async () => {
  await app.request("/auth/forgot-password", json({ email: creds.email }));
  const token = lastResetToken();
  expect((await app.request("/auth/reset-password", json({ token, password: "second reset password ok" }))).status).toBe(200);
  creds.password = "second reset password ok";
  // Replaying the same token now fails.
  expect((await app.request("/auth/reset-password", json({ token, password: "third attempt password" }))).status).toBe(400);
});

test("an unknown/garbage reset token is rejected with 400", async () => {
  expect((await app.request("/auth/reset-password", json({ token: "not-a-real-token", password: "whatever password 1" }))).status).toBe(400);
});

test("an expired reset token is rejected", async () => {
  await app.request("/auth/forgot-password", json({ email: creds.email }));
  const token = lastResetToken();
  // Force the token to be expired in the DB.
  await db.db.updateTable("password_reset_tokens").set({ expires_at: new Date(Date.now() - 1000) }).execute();
  expect((await app.request("/auth/reset-password", json({ token, password: "after expiry password" }))).status).toBe(400);
});

test("JWKS serves the EdDSA public key", async () => {
  const res = await app.request("/auth/.well-known/jwks.json");
  expect(res.status).toBe(200);
  const body = (await res.json()) as { keys: { kty: string; crv: string }[] };
  expect(body.keys[0]!.kty).toBe("OKP");
  expect(body.keys[0]!.crv).toBe("Ed25519");
});
