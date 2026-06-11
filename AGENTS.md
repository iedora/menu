<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# iedora web — project conventions

> Bun-workspaces monorepo with a **Go backend**. The Next.js app
> (`apps/web/`) is UI-ONLY — it serves `menu.iedora.com` (menu app,
> incl. sign-in/up/out) and `iedora.com` (house landing)
> through a Host-based rewrite in `src/proxy.ts`. ALL data, auth and
> business rules live in the Go services (`backend/`). The frontend
> talks to them over HTTP, server-side only.

## What this is

- **Menu** (menu.iedora.com — `apps/web/`) — SaaS multi-tenant restaurant menu builder, including the auth pages (`/sign-in|/sign-up|/sign-out` over the Go auth service). UI in `products/menu/`.
- **House** (iedora.com — `apps/web/src/app/house/`) — brand landing page. One container, one image, two hostnames.
- **Admin** (admin.iedora.com — `backend/cmd/admin`) — staff console. Go templ+HTMX BFF; NOT part of the Next.js app.

**Identity is the Go auth service** (`backend/cmd/auth`): email+password,
EdDSA access JWTs (15 min) + rotating refresh cookie, tenants/memberships.
The Next side is BFF-lite (`@iedora/api-client`): auth server actions
(`products/menu/src/features/auth/actions.ts`) mirror
the access token into the HttpOnly `iedora_access` cookie, `src/proxy.ts`
refreshes it for protected routes, and `serverFetch` attaches the Bearer on
every Go API call. The browser NEVER calls the Go services directly.

## Stack

- **Go** (`backend/`) — chi, pgx, NATS JetStream (audit outbox), Ed25519 JWTs, OTel. Postgres 18, one database per service, migrations owned by each service.
- **Next.js 16** (App Router, Turbopack default) — UI only: RSC reads via `serverFetch`, mutations via server actions.
- **TypeScript** strict, every workspace.
- **shadcn/ui** + Tailwind v4 — menu only. Editorial primitives from **`@iedora/design-system`**.
- **@dnd-kit** — menu's drag-and-drop builder.
- **Bun** — package manager, test runner, dev orchestrator. **Production runtime is Node** — `bun + next build` is unstable as of 2026 (oven-sh/bun#23944).
- **Deploy** — owned by the `iedora-infra` repo (Docker Swarm + Ansible + OpenTofu). This repo ships images: `apps/web/Dockerfile` (UI) and `backend/Dockerfile` (Go binaries).

## File layout

```
iedora/
  bun.lock
  package.json                           workspaces: packages/* + products/* + apps/*
  backend/                               Go backend — auth, menu, audit, billing, admin (one module)
    cmd/<svc>/                           entrypoints; deploy/stack.yml + secrets
    docker-compose.yml                   FULL local backend: Go services + Postgres + NATS + MinIO + OpenObserve

  packages/platform/                     Foundation tier — zero product knowledge
    api-client/                          @iedora/api-client — Go-backend HTTP client: cookies, session, serverFetch, middleware refresh
    brand/                               @iedora/brand — brand strings, product registry, URL validators
    design-system/                       @iedora/design-system — CSS tokens + React primitives
    eslint-config/                       @iedora/eslint-config — shared ESLint config
    observability/                       @iedora/observability — OTel wiring (Next side)

  apps/web/                              Next.js 16 — serves both hostnames, UI only
    src/
      app/                               Routes (menu incl. (auth), house, up)
      generated/surfaces.ts              host-to-surface topology (hand-maintained)
      proxy.ts                           Host rewrite + auth gate + token refresh
    Dockerfile                           Multi-stage, Node runtime

  products/
    menu/                                @iedora/product-menu — menu UI slices (incl. auth) + typed Go client
```

## apps/web — the Next.js shell

### Hard rules

1. **Routes live here, slices live in products/.** `apps/web/src/app/` contains every `page.tsx`, `route.ts`, `layout.tsx`, `not-found.tsx`. Files import from workspace packages by package name — `import { ... } from '@iedora/product-menu/features/auth'`. Adding business logic INSIDE a route file is the bug.

2. **`src/proxy.ts` owns host dispatch + the auth gate.** It is the ONE place that refreshes an expired access token for page loads, so RSCs always read a valid `iedora_access` cookie. Authorization proper stays with the Go services.

3. **`src/app/layout.tsx` + `globals.css` are the only shared chrome.** Per-surface layouts (e.g. the (auth) sign-in shell, dashboard chrome) live at the appropriate sub-route's `layout.tsx`.

4. **No tsconfig path aliasing.** `apps/web/tsconfig.json` has no `paths` entries. Every cross-package import goes through the declared package name.

5. **One image, two hosts.** The Docker image serves `menu.iedora.com` and `iedora.com` from the same node process. Adding a new host = new entry in `generated/surfaces.ts` + new sub-route under `src/app/<host>/` + new workspace dep in `package.json` + new entry in `next.config.ts::transpilePackages` + new project reference in `tsconfig.json::references`.

## Vertical slice pattern — the contract

Every Next.js product follows this. Code is organised as **vertical slices**: each business capability lives in `src/features/<slice>/` and owns its UI + the thin server glue that talks to the Go backend. There is NO data layer on the TypeScript side — no ports/adapters/use-cases, no ORM, no DB fixtures. The Go services own validation, tenancy and persistence; a slice's server code is a thin typed pass-through.

### Slice file layout

```
src/features/<slice>/
├── index.ts                      public API: cached read loaders + types
├── actions.ts                    'use server' shells: typed API call → revalidate
├── ui/                           slice-owned React components (optional)
└── <pure-helper>.ts(.test.ts)    pure domain helpers + their Vitest suites
```

The typed Go client lives at **`src/shared/api.ts`** — one function per endpoint, DTO types mirroring the Go structs. It is the ONLY module that builds menu-service URLs. It sits on `@iedora/api-client`'s `serverFetch`, which attaches the Bearer token from the `iedora_access` cookie and refreshes once on 401.

Reference slices: `features/menu-builder` (read loader + a dozen thin actions), `features/auth` (session guards only — no data), `features/plans` (loader + a static display registry).

### The contract

- **`index.ts`** — read loaders wrapped in `React.cache()` so a guard called twice in one render hits the API once. Marked `'server-only'`. Maps Go DTOs into the shapes the UI renders where they differ.
- **`actions.ts`** — `'use server'` at the top. Each export: typed call from `shared/api.ts` → catch `ApiError` into `{ error: message }` → `revalidatePath(...)`. NO business validation beyond friendly-error zod parses — the Go service is the source of truth and will 422.
- **Full-replace updates**: the Go PATCH/PUT endpoints replace the whole text field set (name + description + i18n). Updating actions must receive the complete fields from the UI (which holds the tree in memory) so a rename doesn't wipe translations.
- **Auth**: `features/auth` exposes `getSession` / `verifySession` / `requireActiveOrganization` / `requireRestaurantBySlug` / `requireStaff`. These only decide where to SEND the visitor; authorization is enforced by Go on every call.

### Cross-slice rules

- Files **inside** a slice import siblings via relative paths.
- Files **across** slices import only via the sibling barrel (`@/features/auth`) or the sanctioned subpaths: `actions`, `ui/**`, `rsc/**`. Everything else is slice-private.
- `src/shared/*` is freely importable — the only horizontal layer (`api.ts`, `url.ts`, `env.ts`, `ui/`).
- Slices don't call each other's loaders from server code; coordination happens in the action shell or the page component that composes both.
- **No cross-product imports.** Menu reaches `@iedora/api-client` / `@iedora/design-system`; nothing reaches across products' source trees.

### The Next.js boundary

- **`'use server'`** lives only in `actions.ts`. Next's directive doesn't traverse barrels reliably — re-exporting an action through `index.ts` silently breaks it.
- **`'server-only'`** lives at the top of `index.ts` barrels and `shared/api.ts`. Crashes at import if anything pulls the module into a Client Component.
- **Slice-owned UI** lives at `src/features/<slice>/ui/*`. Client components declare `'use client'`; Server Components do not need a marker.
- **Route files** in `src/app/` are composition shells: call slice loaders + render slice UI. The route should be small enough to read in one screen.
- **No `middleware.ts`.** Next 16 renamed it to `proxy.ts`. The proxy owns host dispatch + the access-token refresh; redirects there are the gate, authorization lives in Go.

### How to add a feature

1. Add/extend the endpoint functions + DTOs in `src/shared/api.ts` (mirror the Go handler — read `backend/internal/<svc>/httpapi/`).
2. `mkdir src/features/<slice>/{ui}` — `ui/` only if needed.
3. Wire **`index.ts`**: `React.cache()`-wrapped loaders over the api functions, re-export types.
4. If mutations, add **`actions.ts`** with `'use server'`. Each action: api call → `ApiError` → `{ error }` → revalidate.
5. Pure domain helpers (formatting, layout math, validation hints) get co-located Vitest suites.
6. Compose the slice from `src/app/`. The route file should be a thin shell.
7. Backend behaviour changes (new fields, new rules) are Go work first — `backend/` — then the TS contract follows.

## Cross-product hard rules

These bind every product that ships UI to humans (menu + house, plus any future surface).

### 1. Components carry `data-test-id`

Interactive elements — buttons, links, list items, table rows, cards, dialog/sheet roots, status pills, the trigger of any compound widget (Combobox, DropdownMenu, Tabs, …) — MUST expose a `data-test-id` attribute.

Tests target by intent (`getByTestId('qr-codes-create-button')`), not by visible text (drifts with i18n + copy edits) or CSS class (drifts with Tailwind refactors).

**Convention:** `<slice>-<role>[-<modifier>]`. Collections use a stable id suffix:
```
data-test-id="qr-codes-create-button"
data-test-id="menu-builder-item-row-{itemId}"
data-test-id="sessions-revoke-button-{sessionId}"
```

**Form inputs** with an existing `id` + `htmlFor` pair already have a stable selector — adding `data-test-id` is harmless but optional.

**Design-system primitives** (`@iedora/design-system`) forward `data-test-id` to their root via the standard prop-spread; never re-declare on the consumer.

### 2. Visible UI text goes through translation

Every string a user reads in the chrome — button labels, headings, placeholders, helper text, toast messages, error copy, page titles, empty states — MUST be wired through the product's translation library.

**Menu** uses `next-intl`:
- `useTranslations()` in Client Components
- `getTranslations()` in Server Components / route handlers
- Catalogues at `src/i18n/messages/<locale>.json`

**House** lives inside the menu Next.js app at `src/app/house/` and also uses `next-intl`.

**Hard-coded user-visible strings in components are a regression.**

**Exceptions:**
- Brand strings (`@/shared/brand`) — name, taglines, addresses.
- Inline format placeholders (`{0}`, `{count}`) — i18n library handles them.
- `data-test-id` values + other selectors — they're not user-visible.
- Server-side log / error messages thrown for operators (`console.error('[auth/callback] code exchange failed')`) — operator-facing, not user-facing.

**New keys land in EVERY locale catalogue in the same commit.** A missing key renders the namespace path as fallback (`Settings.Slug.label`) — louder than a wrong translation but still wrong.

## Commands

### Root

| Comando | O que faz |
|---|---|
| `bun install` | Instala/refresca dependências de todos os workspaces (instala git hooks via `postinstall`). |
| `bun run dev` | `next dev` em `:3000` (Next lê `apps/web/.env` + `.env.local`). |
| `bun run dev:up` | Boot do backend Go completo (`docker compose -f backend/docker-compose.yml up -d --build`). |
| `bun run dev:down` | Pára containers (mantém volumes). |
| `bun run dev:logs` | Tail dos logs do compose stack. |
| `bun run dev:reset` | Pára + apaga volumes (**perde dados locais**). |
| `bun run typecheck` | TS check paralelo em todos os workspaces. |
| `bun run lint` | ESLint paralelo em todos os workspaces. |
| `bun run test` | Vitest em todos os workspaces. |

### apps/web

| Comando | O que faz |
|---|---|
| `bun run dev` | `next dev` (Turbopack). Normalmente chamado via root `bun run dev`. |
| `bun run build` | `next build` (standalone output para o Dockerfile). |
| `bun run start` | `next start` no output standalone. |
| `bun run typecheck` | `tsgo --build`. |
| `bun run lint` | ESLint com cache. |

### backend/ (Go)

| Comando | O que faz |
|---|---|
| `make test` | Unit tests (sem Docker). |
| `make test-integration` | Integration tests (testcontainers: Postgres real). |
| `make test-all` | Ambos. |
| `make vet` / `make fmt` | Vet + format. |

Schema changes: cada serviço Go é dono das suas migrations (`backend/migrations/<svc>/`); aplica-as com o one-shot `<svc> migrate` (o compose já o faz no arranque).

### Dev local

```bash
bun install
bun run dev:up           # Go backend completo (backend/docker-compose.yml)
bun run dev              # next dev em :3000
```

App env vive em `apps/web/`:
- `.env` — defaults dev (`AUTH_URL`/`MENU_URL` + `NEXT_PUBLIC_*`). Tracked, sem secrets.
- `.env.local` — overrides locais. Gitignored.

### Deploy

Deploy is owned by the **`iedora-infra`** repo (Docker Swarm + Ansible + OpenTofu), not this repo. This repo only ships images.

- **UI image** — CI builds `apps/web/Dockerfile` and pushes `ghcr.io/iedora/web` on every push to `main`. It serves the two public hostnames (menu / apex) and holds NO secrets, NO database client and NO migrations.
- **Backend images** — CI builds the Go services from `backend/Dockerfile` (one binary per service: auth, audit, billing, menu, admin). Each service migrates its own database via the `<svc> migrate` one-shot before serving.
- **Runtime config** — the UI container needs `AUTH_URL` / `MENU_URL` (swarm-internal DNS) and `NEXT_PUBLIC_*` product URLs baked at build time. Everything else (DB URLs, JWT keys, S3 creds) belongs to the Go services.
- **Object storage (R2)** — managed by `iedora-infra` (tofu).

## CI

GitHub Actions, [`.github/workflows/ci.yml`](.github/workflows/ci.yml):
path-filtered correctness (typecheck + lint + test), the Go backend
pipeline (test + build/push), and security (gitleaks + hadolint +
osv-scanner).

## Where to look when unsure

1. `node_modules/next/dist/docs/` — bundled, version-matched Next.js docs.
2. `backend/README.md` — the Go backend's architecture + API surface.
3. `products/menu/src/shared/api.ts` — the typed contract the UI consumes.
4. `products/menu/src/features/README.md` — slice inventory.
5. `.agents/skills/` — project-specific skills (add-language, add-template, reorder-positions, etc.)
