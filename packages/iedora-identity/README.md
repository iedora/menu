# @iedora/identity

Webhook surface for the iedora identity estate. Genkan (the IdP) emits typed
events; first-party products receive them, verify the HMAC-SHA256
signature, and act on them locally. Pattern is analogous to GitHub /
Stripe webhooks — same package, opposite ends.

## Surface

```ts
import {
  createWebhookSender,
  createWebhookReceiver,
  type IdentityEvent,
} from "@iedora/identity";
```

The `IdentityEvent` union is the source of truth — extending it here gives
both sides the new tag with type-narrowing for free.

## Sender (genkan)

```ts
// products/genkan/src/features/webhooks/sender.ts
import { createWebhookSender } from "@iedora/identity";
import { listSubscriptions } from "./adapters/drizzle";

const sender = createWebhookSender({ listSubscriptions });

export async function emit(event: IdentityEvent) {
  await sender.emit(event);
}
```

`emit()` signs the body per-subscriber, POSTs the envelope, retries on 5xx
and network errors, and gives up immediately on 4xx. `onDelivery` is the
observability seam.

## Receiver (menu, future products)

```ts
// products/menu/src/app/api/identity/webhook/route.ts
import { createWebhookReceiver } from "@iedora/identity";
import { db } from "@/shared/db/client";

const receiver = createWebhookReceiver({
  secret: process.env.IEDORA_IDENTITY_WEBHOOK_SECRET!,
  on: {
    "org.member_removed": async ({ org_id, user_id }) => {
      // Revoke local sessions, clear caches, etc.
    },
    "user.deleted": async ({ user_id }) => {
      // ...
    },
  },
});

export const POST = receiver.POST;
```

The handler map is partial — register only what the product cares about.
Unknown events get a 200 and a warn-line.

## Envelope

```json
{
  "id": "evt_2026_05_17_abc123",
  "event": "org.member_removed",
  "payload": { "org_id": "...", "user_id": "..." },
  "occurred_at": "2026-05-17T15:00:00.000Z"
}
```

## Signature header

`x-iedora-signature: t=<epoch-ms>,v1=<hmac_sha256_hex>` — Stripe/Svix style.

The hex digest covers the canonical signed payload `${t}.${body}` (NOT the
body alone). This binds the timestamp into the signature so a replayed
request can't have its `t` field rewritten to satisfy the freshness check.

- `t` is milliseconds since the Unix epoch, set at send time. Each retry
  re-signs with a fresh `t`, so a stuck retry doesn't arrive outside the
  receiver's window.
- `v1` is the scheme version; receivers MAY accept multiple `v1=…` pairs
  to ease secret rotation.
- The body is the **exact raw bytes** on the wire — never a re-serialized
  JSON. Key order is not stable across runtimes.

A secondary `x-iedora-timestamp: <epoch-ms>` header is also emitted for
log readability, but receivers MUST NOT trust it on its own; the
authoritative timestamp lives inside `x-iedora-signature`.

## Configuration

### Sender

```ts
createWebhookSender({
  listSubscriptions,
  // ...
  allowPrivateNetworks: false, // default — keep false in production
  timeoutMs: 10_000,            // per-attempt
  retries: {
    attempts: 3,
    backoffMs: (n) => /* … */ 0,
  },
});
```

- **`allowPrivateNetworks`** (default `false`) — dev-only escape hatch.
  When `false`, every subscription URL is resolved via DNS and rejected if
  the resolved address is in any of: `10/8`, `172.16/12`, `192.168/16`,
  `127/8`, `169.254/16` (link-local + cloud metadata), `100.64/10` (CGNAT),
  `::1`, `fc00::/7`, `fe80::/10`, IPv4-mapped IPv6 of any of the above.
  Non-`http(s):` protocols (`file:`, `gopher:`, `ftp:`) are always
  rejected, even with this flag enabled.

  **Production MUST leave this off.** It exists for local-loop testing
  (e.g. emitting from a dev genkan to a menu receiver on
  `http://localhost:3001`).

### Receiver

```ts
createWebhookReceiver({
  secret,
  on: { /* … */ },
  toleranceMs: 300_000,                  // default 5 min
  dedupTtlMs: 24 * 60 * 60 * 1_000,      // default 24h
  dedupStore: redisBackedStore,          // default: in-process Map
});
```

- **`toleranceMs`** (default `300_000`) — allowed `|now - t|`. Larger
  values cover clock skew at the cost of a wider replay window.
- **`dedupStore`** (default: in-process Map) — implements
  `{ has(id): Promise<boolean>; remember(id, ttlMs): Promise<void> }`.
  The in-process default is single-instance only; multi-replica products
  should pass a Redis or Postgres-backed store so a replay at replica B
  is still caught after first delivery to replica A.
- **`dedupTtlMs`** (default `24h`) — how long an `id` is remembered.

A duplicate `id` within the TTL returns **HTTP 200 with the handler not
invoked** (idempotent receive). This is intentional: the sender sees a
success and stops retrying. If the handler throws on first delivery the
`id` is **not** remembered — the next retry runs the handler again.

## Security model

The package defends against three concrete attacks:

1. **SSRF via subscription URLs.** A malicious admin (or a misconfigured
   `/admin/webhooks` form) could point a webhook at
   `http://infra-postgres:5432` or `http://169.254.169.254/…` and use
   the sender as an internal probe. Before each delivery the sender
   resolves the hostname and rejects private/loopback/link-local IPs.
   The same check applies to URL-literal IPs so a custom resolver can't
   sneak one through.
2. **Replay.** Every signature is bound to a millisecond timestamp via
   `HMAC(secret, "${t}.${body}")`, and the receiver enforces a freshness
   window (default ±5 min). Combined with envelope-id dedup over 24h, a
   captured request is unusable both inside and outside the window.
3. **Forgery via timing oracle.** Signature comparison uses
   `crypto.timingSafeEqual` — never `===` — so an attacker can't learn
   the digest one byte at a time from response timing.

**Known gap (v1):** the SSRF guard does one DNS lookup then immediately
fetches. A TTL-0 record could theoretically be raced between the two,
swapping the resolved IP at fetch time (DNS rebinding). The fetch uses a
sub-millisecond window; in practice form-submitted hostnames and static
A-record rebinds (the realistic attack surface) are blocked. A future
revision will pin the IP via a custom `undici` dispatcher to close the
race entirely. The internal `makePinnedAgent` helper in `ssrf.ts` is the
scaffolding for that — it's exported but not yet wired into the default
fetch path, because attaching a Node http agent to the global `fetch`
varies by Node minor version.
