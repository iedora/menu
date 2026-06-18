import { Database, OutboxWriter, newUserVerifier } from "@iedora/server-kit";
import { type ScratchDatabase, createScratchDatabase } from "@iedora/server-kit/testkit";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { sql } from "kysely";
import { type KeyLike, SignJWT, generateKeyPair } from "jose";

import { buildApp } from "../src/app";
import type { MenuConfig } from "../src/config";
import { Plans } from "../src/plans";
import { Limiter } from "../src/ratelimit";
import type { MenuDB } from "../src/schema";

const ISS = "https://api.iedora.com";
const AUD = "iedora-api";
const TENANT = "11111111-1111-1111-1111-111111111111";
const OTHER_TENANT = "22222222-2222-2222-2222-222222222222";
const USER = "33333333-3333-3333-3333-333333333333";

let scratch: ScratchDatabase;
let db: Database<MenuDB>;
let app: ReturnType<typeof buildApp>;
let privateKey: KeyLike;
// mutable so a test can flip the tenant's effective plan
const planStub = { code: "menu_pro" };

beforeAll(async () => {
  scratch = await createScratchDatabase({ prefix: "menu_dash", migrationsDir: `${import.meta.dir}/../migrations` });
  db = new Database<MenuDB>(scratch.url);

  const kp = await generateKeyPair("EdDSA");
  privateKey = kp.privateKey;
  const cfg = { rateLimitDisabled: true } as MenuConfig;
  app = buildApp({
    db,
    limiter: new Limiter(db, true),
    userVerifier: newUserVerifier(kp.publicKey, ISS, AUD),
    auditor: new OutboxWriter(db, "menu"),
    plans: new Plans({ planCode: async () => planStub.code }, db),
    cfg,
  });
});

afterAll(async () => {
  await db?.close();
  await scratch?.drop();
});

async function token(opts: { tenant?: string | null; roles?: string[] } = {}): Promise<string> {
  const claims: Record<string, unknown> = { typ: "access", roles: opts.roles ?? [] };
  if (opts.tenant !== null) claims.tid = opts.tenant ?? TENANT;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "EdDSA", kid: "k1" })
    .setSubject(USER)
    .setIssuer(ISS)
    .setAudience(AUD)
    .setExpirationTime("10m")
    .sign(privateKey);
}

const auth = async (t?: string) => ({ authorization: `Bearer ${t ?? (await token())}` });
const post = async (body: unknown, t?: string) => ({
  method: "POST",
  headers: { ...(await auth(t)), "content-type": "application/json" },
  body: JSON.stringify(body),
});
const patch = async (body: unknown) => ({ ...(await post(body)), method: "PATCH" });
const put = async (body: unknown) => ({ ...(await post(body)), method: "PUT" });

let slug = "";

test("rejects a request without a token (401) and a tenant-less token (403)", async () => {
  expect((await app.request("/api/restaurants")).status).toBe(401);
  const noTenant = await token({ tenant: null });
  expect((await app.request("/api/restaurants", { headers: await auth(noTenant) })).status).toBe(403);
});

test("create a restaurant (slug derived) + it's listed with counts", async () => {
  const res = await app.request("/api/restaurants", await post({ name: "Tasca do Zé", defaultLanguage: "pt" }));
  expect(res.status).toBe(200);
  const r = (await res.json()) as { slug: string; defaultLanguage: string };
  expect(r.slug).toBe("tasca-do-ze");
  expect(r.defaultLanguage).toBe("pt");
  slug = r.slug;

  const list = await app.request("/api/restaurants", { headers: await auth() });
  const body = (await list.json()) as { restaurants: { slug: string; menuCount: number }[] };
  expect(body.restaurants.length).toBe(1);
  expect(body.restaurants[0]!.slug).toBe("tasca-do-ze");

  // the create emitted an audit event into the outbox
  const n = await sql<{ n: string }>`SELECT count(*)::text AS n FROM outbox`.execute(db.root);
  expect(Number(n.rows[0]!.n)).toBe(1);
});

test("the plan gate blocks creating past the limit", async () => {
  planStub.code = "menu_free"; // restaurants: 1, already at 1
  const res = await app.request("/api/restaurants", await post({ name: "Second" }));
  expect(res.status).toBe(422);
  planStub.code = "menu_pro";
});

test("GET /api/plan returns the effective entitlements", async () => {
  const res = await app.request("/api/plan", { headers: await auth() });
  expect(((await res.json()) as { code: string; restaurants: number }).restaurants).toBe(3);
});

test("builder: create menu → category → item, then the tree reflects them", async () => {
  const m = await app.request(`/api/restaurants/${slug}/menus`, await post({ name: "Almoço" }));
  const menuId = ((await m.json()) as { id: string }).id;
  const cat = await app.request(`/api/restaurants/${slug}/menus/${menuId}/categories`, await post({ name: "Pratos" }));
  const catId = ((await cat.json()) as { id: string }).id;
  const it = await app.request(
    `/api/restaurants/${slug}/categories/${catId}/items`,
    await post({ name: "Bacalhau", priceCents: 1200, nameI18n: { en: "Cod" } }),
  );
  expect(it.status).toBe(200);

  const tree = await app.request(`/api/restaurants/${slug}/tree`, { headers: await auth() });
  const body = (await tree.json()) as {
    defaultLanguage: string;
    menus: { name: string; categories: { name: string; items: { name: string; nameI18n: unknown }[] }[] }[];
  };
  expect(body.defaultLanguage).toBe("pt");
  expect(body.menus[0]!.name).toBe("Almoço");
  expect(body.menus[0]!.categories[0]!.items[0]!.name).toBe("Bacalhau");
  expect(body.menus[0]!.categories[0]!.items[0]!.nameI18n).toEqual({ en: "Cod" });
});

test("seed creates the sample menu", async () => {
  const res = await app.request(`/api/restaurants/${slug}/seed`, await post({}));
  expect(res.status).toBe(200);
  expect(((await res.json()) as { menuId: string }).menuId).toBeTruthy();
});

test("changing the default language rotates content (promote)", async () => {
  // promote pt → en: the pt plain value demotes into i18n.pt, en override promotes to plain
  const res = await app.request(
    `/api/restaurants/${slug}`,
    await patch({ defaultLanguage: "en", supportedLanguages: ["en", "pt"] }),
  );
  expect(res.status).toBe(200);
  const tree = await app.request(`/api/restaurants/${slug}/tree`, { headers: await auth() });
  const body = (await tree.json()) as {
    defaultLanguage: string;
    menus: { categories: { items: { name: string; nameI18n: Record<string, string> }[] }[] }[];
  };
  expect(body.defaultLanguage).toBe("en");
  const item = body.menus.flatMap((m) => m.categories).flatMap((c) => c.items).find((i) => i.name === "Cod");
  expect(item).toBeTruthy(); // the en override is now the plain value
  expect(item!.nameI18n.pt).toBe("Bacalhau"); // the old default demoted into the i18n map
});

test("reorder rejects a list that does not name every child exactly once (422)", async () => {
  const tree = await app.request(`/api/restaurants/${slug}/tree`, { headers: await auth() });
  const menuId = ((await tree.json()) as { menus: { id: string }[] }).menus[0]!.id;
  const res = await app.request(
    `/api/restaurants/${slug}/menus/${menuId}/category-order`,
    await put({ orderedIds: ["aaaaaaaa-0000-0000-0000-000000000000"] }),
  );
  expect(res.status).toBe(422);
});

test("tenancy: another tenant's token cannot see the restaurant (404), unknown slug 404", async () => {
  const other = await token({ tenant: OTHER_TENANT });
  expect((await app.request(`/api/restaurants/${slug}/tree`, { headers: await auth(other) })).status).toBe(404);
  expect((await app.request(`/api/restaurants/nope/tree`, { headers: await auth() })).status).toBe(404);
});

test("staff token reaches a foreign tenant's restaurant (cross-tenant scope)", async () => {
  const staff = await token({ tenant: OTHER_TENANT, roles: ["iedora-admin"] });
  const res = await app.request(`/api/restaurants/${slug}`, { headers: await auth(staff) });
  expect(res.status).toBe(200);
});
