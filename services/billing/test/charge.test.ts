import { expect, test } from "bun:test";

import { bearer, useHarness } from "./harness";

const h = useHarness();

async function postCharge(body: unknown) {
  return h.app.request("/billing/charges", {
    method: "POST",
    headers: { ...bearer(h), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("rejects without a service token", async () => {
  const res = await h.app.request("/billing/charges", { method: "POST", body: "{}" });
  expect(res.status).toBe(401);
});

test("marketplace charge splits gross into platform fee + payee net", async () => {
  // tutor-style: $50 lesson, student pays, tutor is the payee, 20% commission.
  const res = await postCharge({
    product: "tutor",
    payer: "student-1",
    payee: "tutor-9",
    amountCents: 5000,
    currency: "USD",
    feeRate: 0.2,
  });
  expect(res.status).toBe(200);
  const c = (await res.json()) as { id: string; amountCents: number; feeCents: number; netCents: number; status: string; payee: string };
  expect(c.amountCents).toBe(5000);
  expect(c.feeCents).toBe(1000); // 20%
  expect(c.netCents).toBe(4000); // tutor payout
  expect(c.payee).toBe("tutor-9");
  expect(c.status).toBe("paid"); // ManualGateway settles instantly

  // GET reads it back.
  const got = await h.app.request(`/billing/charges/${c.id}`, { headers: bearer(h) });
  expect(got.status).toBe(200);
  expect(((await got.json()) as { id: string }).id).toBe(c.id);
});

test("platform-only charge keeps the whole amount (net 0)", async () => {
  // menu-style: a tenant pays the platform; no payee.
  const res = await postCharge({
    product: "menu",
    payer: "tenant-abc",
    amountCents: 2999,
    currency: "USD",
  });
  const c = (await res.json()) as { feeCents: number; netCents: number; payee: string | null };
  expect(c.feeCents).toBe(2999);
  expect(c.netCents).toBe(0);
  expect(c.payee).toBeNull();
});

test("idempotency key dedupes a retried charge", async () => {
  const body = { product: "menu", payer: "tenant-idem", amountCents: 1000, currency: "USD", idempotencyKey: "charge-key-1" };
  const a = (await (await postCharge(body)).json()) as { id: string };
  const b = (await (await postCharge(body)).json()) as { id: string };
  expect(b.id).toBe(a.id); // same row, not a second charge
});

test("rejects a malformed body", async () => {
  const res = await postCharge({ product: "menu" }); // missing payer/amount
  expect(res.status).toBe(400);
});
