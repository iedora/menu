# Architecture — the iedora monorepo

> One-line purpose: how the code is organised across products and
> shared packages, why it's organised that way, and what you do when
> you add a new feature.
> **Last updated:** 2026-05.

## The shape in one paragraph

**iedora** is a Bun-workspaces monorepo with two Next.js products
(Menu, Genkan), one Astro static site (House), and three shared
packages (`@iedora/design-system`, `@iedora/identity`,
`@iedora/auth-testkit`). Inside each Next.js product, code is
organised as **vertical slices** on the outside and **light
hexagonal** on the inside. Each business capability lives in
`src/features/<slice>/` and owns everything it needs: a port (the
interface to the outside world), one or more adapters (production
+ tests), pure-ish use-cases that take the port as their first
argument, an `actions.ts` shell for Next.js Server Actions,
slice-owned UI, and a single `index.ts` barrel that exposes the
public API. `src/shared/` holds primitives with no domain
knowledge. `src/app/` is the delivery layer. **Next.js is a
delivery detail**, not the architecture.

## Monorepo shape

```
iedora/
  packages/
    design-system/                @iedora/design-system   (editorial CSS + React primitives)
    iedora-identity/              @iedora/identity        (webhook sender + receiver + secret cipher)
    iedora-auth-testkit/          @iedora/auth-testkit    (in-process Better Auth + PGLite for tests)
  products/
    menu/                         Menu  — menu.iedora.com    (SaaS restaurant menu builder)
    genkan/                       Genkan — genkan.iedora.com (the iedora IdP)
    house/                        House — iedora.com         (Astro static landing page)
  bun.lock                        single workspace lockfile
  package.json                    workspaces: packages/*, products/genkan, products/house, products/menu
```

We chose **Bun workspaces** specifically because:

- Bun is already our package manager (`bun install` is ~10× faster
  than npm in this repo's shape), and Bun's workspace resolution
  is built into the runtime — no extra tool to install.
- The lockfile is a single `bun.lock` at the root. Every product
  and every package pins through it; reproducibility across CI
  jobs is a `bun install --frozen-lockfile`.
- `workspace:*` deps resolve via symlinks, so editing
  `packages/iedora-identity/src/sender.ts` and re-running
  `bun run test` in `products/genkan/` picks up the change with
  zero rebuild.
- We considered pnpm (more mature, similar story) and Nx/Turbo
  (caching/orchestration on top). Both would add a layer we
  didn't need — CI runs are fast enough that per-package caching
  hasn't been worth the config cost. We can add Turbo later
  without changing the workspace layout.

`bun install` at the repo root is the only install command
anyone runs day-to-day. Inside a product or package, `bun run X`
finds the local `package.json` script; you almost never `cd` to
install.

## Vertical slices + light hexagonal

Both Next.js products (menu and genkan) use the same internal
shape. Each slice keeps the same five files (give or take
co-located tests and UI):

```
src/features/<slice>/
├── README.md                     short doc — public API + the why
├── index.ts                      public API: cached page guards + types
├── ports.ts                      narrow interfaces describing every external effect
├── adapters/
│   ├── drizzle.ts                production adapter against Drizzle + Postgres
│   └── …                         alternative adapters (better-auth, s3, genkan-http, …)
├── use-cases/
│   └── <verb>.ts                 pure-ish (port, input) -> result
├── actions.ts                    'use server' shells: auth guard → use-case → revalidate
├── ui/                           slice-owned React components (optional)
└── <slice>.test.ts (or __tests__/<verb>.test.ts)
                                  co-located Vitest suite — fakes the port, hits PGLite
```

Reference templates worth reading top-to-bottom:

- `products/menu/src/features/auth/` — the canonical small slice.
  Ports, two adapters (better-auth instance + gateway), five
  use-cases, one co-located test file.
- `products/genkan/src/features/auth/` — the same shape, slightly
  larger. Adds `cron.ts` (in-process JWKS rotation) and
  `oidc/discovery.ts` (custom additions to
  `/.well-known/openid-configuration`).
- `products/genkan/src/features/audit/` — a "library inside a slice"
  example. `chain.ts` (sha256-chain helpers + advisory-lock key
  constant), `verify.ts` (walks the chain, returns first tamper
  point), an adapter that calls `pg_advisory_xact_lock` before
  every `INSERT`, two use-cases (`record-event`, `list-events`),
  and a `chain.test.ts` that exercises the verifier against
  PGLite.

Larger slices (e.g. menu's `menu-builder`, `menu-publishing`,
`upload`) add `types.ts` / `format.ts` / `range.ts` for domain
helpers. Smaller slices collapse the boilerplate (menu's
`i18n` has no adapter layer because the language registry is pure
data).

## Menu's slice inventory

Path: `products/menu/src/features/`.

- **`auth/`** — session + tenant-scoping guards. Wraps the
  Better Auth client (which itself federates to genkan).
  `verifySession`, `requireRestaurantAccess`,
  `requireRestaurantBySlug`, `requireActiveOrganization`.
- **`billing/`** — invoice ledger (year filter). Read-only today.
- **`dashboard-home/`** — the restaurants-with-counts aggregate
  query that backs the dashboard landing page.
- **`i18n/`** — per-language registry (en, pt, es, fr) + format
  helpers + the tabbed `LocalizedFields` editor UI. Registry
  pattern; new language = new folder under `languages/`.
- **`identity/`** — the federation seam. HTTP adapter calling
  genkan's `/api/identity/organization/*` endpoints with the
  user's OAuth access token. Menu owns ZERO organization data;
  this slice is the only place the org list, active org, and
  org-create flow are touched.
- **`menu-builder/`** — the dnd-kit admin builder. Menu / category
  / item CRUD + reorder. Server actions handle the position
  recompute in a single transaction (see hard rule #7).
- **`menu-publishing/`** — the public-side render path. The
  `loadRestaurantSnapshot` / `loadRestaurantAdminMenus` cache
  wrappers (per-slug tag), the template registry, the renderer,
  and the sample-data seed payload.
- **`metrics/`** — daily-view counters + analytics range helpers.
  Reads aggregated daily rows; writes are driven by the beacon
  endpoint, not this slice.
- **`plans/`** — plan registry (free, casa). Same shape as i18n
  and templates; `canAddRestaurant(orgId)` and `planHas` are the
  only gates.
- **`rate-limit/`** — Better Auth's rate-limit store backed by
  Redis (testcontainers in dev/CI). Unit tests exercise the real
  Redis adapter.
- **`restaurant-identity/`** — restaurant CRUD + theme/identity
  settings (logo, fonts, palette).
- **`upload/`** — S3-compatible uploads. Presign + commit + clear,
  with the `r/{restaurantId}/...` key-prefix invariant verified
  twice (see hard rule #9). LocalStack in dev + CI; real R2 in
  production.

## Genkan's slice inventory

Path: `products/genkan/src/features/`.

- **`admin/`** — read-side aggregates for `/admin/*` pages.
  `listUsers`, `listOrganizations`, `listApplications`,
  `listSessions`, `listGrants`. Also home to
  `requireAdmin()` — the platform-admin guard. The matching
  write actions live in `src/app/admin/<entity>/[id]/actions.ts`
  because they need request-scoped headers / cookies; the slice
  itself stays pure.
- **`audit/`** — the tamper-evident `audit_log`. Writer in
  `adapters/drizzle.ts` (advisory-locked); chain helpers in
  `chain.ts`; verifier in `verify.ts`; reader in
  `use-cases/list-events.ts`. Also exposes a `sender.ts`
  that forwards typed events to `@iedora/identity`'s webhook
  sender for downstream products. See genkan hard rule #2.
- **`auth/`** — Better Auth instance + gateway + reauth + JWKS
  rotation cron + bearer-auth verifier for `/api/identity/*`.
  Houses every DAL guard genkan exposes:
  `verifySession`, `requireFreshSession`,
  `requireActiveOrganization`, `getEffectiveOrganizationId`,
  `listUserOrganizations`. `cron.ts::startCron()` is started
  exactly once from `src/instrumentation.ts`. The `oidc/`
  subfolder is where `/.well-known/openid-configuration` gets
  extended.
- **`profile/`** — user-facing profile reads (the user's own
  organization list, OAuth grant list). Tiny slice — no adapter
  layer, just two use-cases that read through `audit` and
  `admin`-shaped queries.
- **`webhooks/`** — webhook-subscription CRUD + dispatch.
  Subscription rows live in genkan's DB; the sender comes from
  `@iedora/identity`, the secret cipher comes from
  `@iedora/identity/secret-storage`, so this slice is mostly
  wiring + admin UI hooks.

## The shared packages

### `@iedora/design-system` — `packages/design-system/`

The editorial primitives every product renders out of. Paper, ink,
cinnabar; Fraunces + JetBrains Mono; hairline rules. The package
ships:

- A CSS bundle (`styles.css`, `tokens.css`, `fonts.css`) that
  every product imports once in its root layout.
- A React component barrel: editorial chrome (`Wordmark`,
  `MetaStrip`, `Statement`, `Lintel`), motion primitives
  (`ScrollPinned`, `Phrases`, `Timeline`, `Wave`), and the
  Manual's §VI primitives (`Button`, `Card`, `Dialog`, `Field`,
  `Table`, `Toast`, `Tabs`, `Breadcrumb`, …).
- Workspace-published as `@iedora/design-system`; consumed by
  menu, genkan, and house. Tests live in
  `packages/design-system/src/test/` (jsdom + Testing Library).

Menu also keeps shadcn primitives under
`products/menu/src/shared/ui/`. That's deliberate: shadcn pieces
that don't have an editorial equivalent (e.g. `dropdown-menu`,
`label`, `editorial-list`) stay menu-local until the design
system grows to subsume them.

### `@iedora/identity` — `packages/iedora-identity/`

The webhook surface for the iedora identity estate. Genkan emits
typed `IdentityEvent`s; products receive them, verify the
HMAC-SHA256 signature, dedup, and act locally.

- `events.ts` — the `IdentityEvent` union. Extending it here
  gives both ends type-narrowing for free.
- `sender.ts` — signs the body per-subscriber, POSTs the
  envelope, retries on 5xx, gives up on 4xx. Uses `ssrf.ts` to
  reject private/loopback/link-local hosts.
- `receiver.ts` — verifies the signature, enforces a freshness
  window (default ±5 min via `toleranceMs`), dedups by
  envelope id over 24h.
- `signature.ts` — Stripe/Svix-style `x-iedora-signature:
  t=<ms>,v1=<hmac>` header; the digest covers `${t}.${body}` so
  replaying with a rewritten `t` fails the verify.
- `ssrf.ts` — DNS resolve + private-CIDR reject. Known gap
  (DNS rebinding race) called out in the README.
- `secret-storage.ts` — AES-256-GCM with an HKDF-derived key
  (input keying material: `BETTER_AUTH_SECRET`). Used by genkan
  to encrypt webhook subscription secrets at rest.

Tests in `src/__tests__/` are DB-less — pure crypto and parsing.

### `@iedora/auth-testkit` — `packages/iedora-auth-testkit/`

The integration-test fixture. Boots a real Better Auth +
`@better-auth/oauth-provider` instance against PGLite on a random
local port, applies genkan's migrations, and returns a handle:

```ts
const handle = await startTestGenkan({
  clients: [{ client_id: 'menu', client_secret: '…', redirect_uris: […] }],
})
// → { url, discoveryUrl, stop, seed: { user, organization, member, grant },
//     auth, db }
```

The same Better Auth code that runs in production runs in the
test — only the config and the DB swap. Cold start is ~150ms;
the smoke test pins a 1500ms hard ceiling.

Consumed by:

- Menu's Playwright e2e suite — `playwright.config.ts`'s
  `webServer` starts a testkit instance on `SHIM_PORT` so the
  full OIDC bounce runs against an in-process genkan.
- Menu's unit suite when it wants a real bearer token without a
  full handshake — `signTestToken({ handle, userId, scopes })`
  mints a JWT signed by the test instance's JWKS.
- Genkan's own integration tests in
  `products/genkan/src/features/auth/__tests__/` when they need
  a fully wired Better Auth on top of a fresh DB (e.g.
  `impersonation.test.ts`, `rotate-jwks.test.ts`).
- A `./schema` subpath export so tests can introspect rows
  directly via Drizzle if they need to assert state.

## Why this shape

We landed on it after an audit of an earlier `lib/`-flat
structure with everything in one app. The problems were the usual
ones for a growing Next.js app: domain code mixed with framework
code; auth, DB, and rendering tangled in the same file; tests that
needed half the world to run; "where does X go?" had no answer.

**Vertical slices** solve the layout question: every feature is a
folder you can read top-to-bottom. The **light hexagonal layer
inside a slice** keeps the domain logic testable without a full
Next request context — use-cases take a port, so a Vitest test
wires that port to a real PGLite database instead of mocking
Drizzle. We deliberately stopped short of a full DDD/onion
arrangement; there is no `domain/`, no `entities/`, no DI
container. The port is the only seam.

**Splitting menu and genkan into separate products** answered a
separate question: how do you offer SSO to future iedora apps
without coupling each one to menu's schema? Genkan owns the
identity tables; menu and any future product own only their
domain data. The federation boundary is the OIDC handshake +
typed webhook events — strict enough to keep the apps independent,
loose enough that a new product is "ship a Better Auth instance
that consumes genkan" rather than a database migration.

**Pulling the cross-product code into `packages/`** answered the
third question: how do you keep both apps speaking the same
visual language and the same webhook envelope without copy-paste?
A workspace package, peer-depended on the same Better Auth + React
versions, resolved via `workspace:*`.

## When to put code where

A quick decision tree. (See `docs/tenancy.md` for the
specifically-about-tenancy variant.)

- **Does it know about a specific product's domain (menus,
  restaurants, plans, audit logs, OAuth grants)?**
  → `products/<product>/src/features/<slice>/`. New slice if no
  existing one fits; new use-case in an existing slice otherwise.
- **Is it a primitive with no domain knowledge that one product
  uses?**
  → `products/<product>/src/shared/`. DB client, env validation,
  shadcn primitives, test fixtures, the `cn()` helper.
- **Will two or more products need the exact same code?**
  → A workspace package under `packages/`. The bar is real reuse,
  not "might someday." When in doubt, copy it twice; promote on
  the third use.
- **Is it identity-or-auth shared surface (webhook envelope,
  signature, secret cipher, OIDC test fixture)?**
  → `@iedora/identity` or `@iedora/auth-testkit`. Those are the
  two seams the federation pattern depends on; everything else
  can stay product-local.
- **Is it visual chrome that the brand needs to render
  identically across products?**
  → `@iedora/design-system`. Editorial primitives, motion
  primitives, the Manual's §VI components.
- **Is it a Next.js route file?**
  → `src/app/`. Routes compose slice exports; they're not where
  business logic lives.
- **Is it a Next 16 long-running background job (cron, queue
  consumer)?**
  → A slice use-case + a `start*()` driver in the slice
  (`features/auth/cron.ts` is the reference), wired from
  `src/instrumentation.ts`. Gated on
  `NEXT_RUNTIME === 'nodejs'`.

## The contract

- **`ports.ts`** — narrow interfaces describing the slice's
  effects on the outside world. One method per atomic operation.
  No Drizzle / Next / Better Auth types leak through (`Session`
  is the one common exception — Better Auth's own type re-exported
  via the adapter).
- **`adapters/`** — implementations. Production adapters are
  marked `'server-only'`. Tests build their own adapter against
  PGLite (see `products/menu/src/features/auth/auth.test.ts` or
  `products/genkan/src/features/audit/__tests__/chain.test.ts`).
- **`use-cases/<verb>.ts`** —
  `async function verb(port: Port, input): Promise<Result>`.
  Pure-ish: takes inputs, returns outputs, calls port methods. The
  only Next API allowed inline is `redirect()` / `notFound()` —
  and tests mock those (see `docs/testing.md`).
- **`index.ts`** — binds the production adapter, wraps page-level
  loaders in `React.cache()`, re-exports the types callers need.
  Does *not* export the adapter.
- **`actions.ts`** — `'use server'` at the top. Each export:
  auth guard → call the use-case with the production adapter →
  revalidate (menu: `revalidateRestaurant(slug)` per the cache
  rule; genkan: `revalidatePath('/admin/<entity>')` or similar).

## Cross-slice rules

- Files **inside** a slice import siblings via relative paths
  (`./adapters/drizzle`, `../ports`).
- Files **across** slices import only via the sibling barrel
  (`@/features/auth`, `@/features/menu-publishing`). Reaching into
  `@/features/auth/use-cases/...` from another slice is a
  boundary violation flagged by `eslint-plugin-boundaries` in
  menu's config.
- `src/shared/*` is freely importable from anywhere — it's the
  only horizontal layer.
- Use-cases inside a slice do not call into other slices. If two
  slices need to coordinate, the coordination happens in the
  action shell or in the page component that composes both.
  Slices stay leaf-shaped.
- **Cross-product imports go through a workspace package.** Menu
  never imports from `products/genkan/`; it imports
  `@iedora/identity` (for the webhook envelope) and talks HTTP
  to genkan otherwise. Tests are the one exception — menu's e2e
  imports `@iedora/auth-testkit`, which itself imports genkan's
  schema via a relative path that only resolves inside the
  workspace.

## The Next.js boundary

- **`'use server'`** lives only in `actions.ts`. Next's directive
  does not traverse barrels reliably — re-exporting an action
  through `index.ts` silently breaks it.
- **`'server-only'`** lives at the top of adapters, use-cases,
  and slice barrels that touch the DB. It crashes at import if
  anything pulls the module into a Client Component, which is
  the protection we want.
- **Slice-owned UI** lives at `src/features/<slice>/ui/*`.
  Client components declare `'use client'` themselves; Server
  Components do not need a marker.
- **Route files** in `src/app/` are composition shells: page →
  call slice loaders + render slice UI. The route should be
  small enough to read in one screen; if it isn't, the missing
  piece is a slice helper.
- **`src/instrumentation.ts`** is Next 16's process-init hook —
  use it to start long-running jobs (see genkan's
  `startCron`). Gate on `NEXT_RUNTIME === 'nodejs'` so the
  Edge build doesn't pull server-only code into static analysis.
- **No `middleware.ts`.** Next 16 renamed it to `proxy.ts`.
  The proxy is for *optimistic* redirects only (cookie presence
  checks). Real auth always lives in the DAL.

## How to add a new feature

1. Pick the product. Menu? Genkan? If the answer is "both",
   the answer is "neither — promote it to a package."
2. `mkdir src/features/<slice>/{adapters,use-cases,ui}` —
   `ui/` only if needed.
3. Sketch **`ports.ts`** first. Write the interface as if the
   rest of the world doesn't exist; one method per atomic
   effect.
4. Implement **`adapters/drizzle.ts`** (or the relevant
   production adapter). Mark `'server-only'`.
5. Write **`use-cases/<verb>.ts`** — pure functions taking the
   port as the first argument. Validate input with Zod inline
   (return `{ error: '...' }` on failure; don't throw).
6. Wire **`index.ts`**: bind the production adapter, wrap page
   loaders in `React.cache()`, re-export the public types.
7. If there are mutations, add **`actions.ts`** with
   `'use server'`. Each action: auth guard (menu's
   `requireRestaurantBySlug` or genkan's `requireAdmin` +
   `requireFreshSession` for destructive admin work) → run
   use-case → revalidate.
8. Add **`<slice>.test.ts`** (menu convention) or
   **`__tests__/<verb>.test.ts`** (genkan convention) alongside
   the source. Use `makeTestDb()` from
   `@/shared/testing/pglite`, hand-roll a port adapter against
   the test DB, and exercise the use-cases. If the slice
   touches OIDC or Better Auth in non-trivial ways, reach for
   `@iedora/auth-testkit`'s `startTestGenkan()` and exercise
   the real handshake.
9. Write a short **`README.md`** at the slice root: public API,
   port summary, one-line rationale.
10. Compose the slice from `src/app/` (one route imports the
    loader + UI, the other imports the action). The route file
    should be a thin shell.

Registry-shaped features (asset targets, languages, plans,
templates) have dedicated skills under `.claude/skills/`. Use
those instead of inventing a new pattern.

## What goes in `src/shared/`

(Per product — both menu and genkan have one.)

- `src/shared/db/client.ts` — singleton `postgres-js` client
  (HMR-safe via `globalThis`).
- `src/shared/db/schema.ts` — the single canonical schema for
  that product. Menu owns its domain tables. Genkan owns
  `user`, `session`, `account`, `organization`, `member`,
  `invitation`, `oauth_application`, `oauth_consent`, `jwks`,
  `audit_log`, `webhook_subscription`, `webhook_delivery`.
- `src/shared/env.ts` — Zod-validated runtime env. Returns a
  build-time stub Proxy when `SKIP_ENV_VALIDATION=1` so
  `next build` can collect page data without secrets.
- `src/shared/brand.ts` (menu only, for now) — brand strings +
  `GENKAN_URL`. Imported by client components; the value is
  inlined into the client bundle at build time.
- `src/shared/ui/` — shadcn primitives + generic cross-slice
  components (menu's editorial-list lives here). Nothing
  domain-shaped.
- `src/shared/utils.ts` — `cn()` and other framework-agnostic
  helpers.
- `src/shared/testing/pglite.ts` — the `makeTestDb()` fixture
  used by every unit test.

If it knows about menus, restaurants, plans, languages, uploads,
audit logs, OAuth grants, or webhook subscriptions, it does NOT
belong here. Put it in the slice.

## What goes in `src/app/`

- **Routes** — `src/app/<path>/page.tsx`,
  `src/app/<path>/layout.tsx`,
  `src/app/api/<route>/route.ts`. These compose slice exports.
- **Private folders** — `src/app/_components/<name>/` for
  page-local UI that only one route uses (Next's `_*` convention
  keeps them out of the routing table). Menu's
  `_components/landing/` is the canonical example.
- **Action files** in admin routes (genkan) — server actions
  that need request-scoped headers/cookies live next to the page
  that uses them (`src/app/admin/users/[id]/actions.ts`) rather
  than in the slice. The slice provides the use-case; the
  action shell wires the request scope around it.
- **No business logic.** A route file should not contain
  Drizzle queries, Zod schemas, or domain rules. If it does,
  lift it into the slice.

## Anti-patterns

- **A Repository class per entity.** We have ports per slice,
  not per table.
- **A DI container.** Use-cases take their port as the first
  argument; `index.ts` binds the production one. That's the
  whole DI story.
- **A `domain/` or `entities/` folder.** Drizzle row types are
  domain-enough. Add helpers in `<slice>/types.ts` if you really
  need a named alias.
- **A `lib/` folder for new code.** That was the structure we
  migrated away from. New code goes in
  `src/features/<slice>/` or `src/shared/`.
- **A barrel inside a slice.** Only the slice root `index.ts`
  is a barrel; inner folders import each other directly so the
  dependency graph stays legible.
- **A Server Action in a non-`actions.ts` file.** Next's
  `'use server'` directive doesn't traverse barrels reliably;
  symptom is a bundling error or a silently-broken mutation.
- **Reaching into a sibling slice's internals.** Importing
  `@/features/auth/use-cases/require-restaurant-access`
  directly bypasses the barrel and breaks the lint rule.
  Use `@/features/auth`.
- **Cross-product imports.** Menu imports from genkan? Never.
  The federation boundary is OIDC + typed webhook events. The
  workspace packages exist precisely so neither product reaches
  into the other's tree.

See [`AGENTS.md`](../AGENTS.md) for the menu + genkan hard rules
and the full file layout. See [`testing.md`](testing.md) for the
test pyramid.
