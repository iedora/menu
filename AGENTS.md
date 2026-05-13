<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Meta Menu — project conventions

## What this is
SaaS multi-tenant restaurant menu builder. Each tenant is a Better Auth `organization` that owns one or more `restaurant` rows. Admins build menus via drag-and-drop; the public menu renders from the same data.

## Stack
- **Next.js 16** (App Router, Turbopack default, Cache Components)
- **TypeScript** strict
- **Drizzle ORM** + `postgres-js` driver, **Postgres 18**
- **Better Auth** with `organization` plugin
- **shadcn/ui** + Tailwind v4
- **@dnd-kit** for drag-and-drop
- **Bun** as package manager and test runner; **Node** as production runtime (Bun + `next build` is unstable as of 2026 — see oven-sh/bun#23944)

## Hard rules

1. **Tenant scoping is mandatory.** Every query touching `restaurant`, `menu`, `category`, or `item` MUST filter by `restaurantId` AND verify the caller is a `member` of the parent `organization`. Never trust IDs from the client without rechecking ownership. Centralize this in `lib/dal.ts` — use `requireRestaurantAccess(restaurantId)` before any tenant query.

2. **Schema is the source of truth.** `lib/db/schema.ts` is the single canonical schema. Migrations are generated, not handwritten — run `bun run db:generate` then `bun run db:migrate`.

3. **Auth checks belong in the data layer, not in layouts.** Layouts in Next 16 don't re-render on navigation, so an auth check in a layout WILL leak. Use `verifySession()` / `requireRestaurantAccess()` from `lib/dal.ts` close to the data fetch or in the page component itself. The dashboard layout fetches session/plan defensively for chrome (email, Analytics link) but never redirects from there.

4. **Use shadcn via MCP** when possible. `bunx shadcn@latest add <component>` works too. Don't hand-write primitives that already exist in shadcn.

5. **No `middleware.ts`.** Next 16 renamed it to **`proxy.ts`**. The proxy is for *optimistic* redirects only (cookie presence checks). Real auth always lives in the DAL.

6. **Money is integer cents** in `priceCents`, currency in a separate column. Never use floats for prices.

7. **Drag-and-drop reordering** uses integer `position` columns (per parent). On reorder, recompute positions for affected rows in a single transaction. Renumber periodically if gaps grow.

8. **Menu templates are open/closed.** Each template lives in its own folder under `components/menu/templates/<id>/` and exports a `template: MenuTemplate` from `index.ts`. The renderer (`menu-renderer.tsx`) consumes only the registry — never edit it to support a new template. Adding a template = new folder + 1 import + 1 entry in `templates/registry.ts` + the literal in `RestaurantTheme.layout` (schema). LAYOUTS in `lib/menu-themes.ts` is derived from the registry; do not maintain it separately.

9. **Asset keys are tenant-prefixed and verified twice.** Every uploaded object's S3 key starts with `r/{restaurantId}/`. The `requireRestaurantAccess` DAL guard runs first; `assertKeyBelongsToTarget` then rejects any commit whose key doesn't match the target's restaurant — defense-in-depth against a stale presign being redirected. New asset targets must follow the same `r/{restaurantId}/...` scheme in `lib/storage/targets.ts` and gate item-scoped uploads with an extra ownership check (see `assertItemBelongsToRestaurant`).

10. **Languages live in a registry.** Each supported language is a self-contained module under `lib/i18n/languages/<code>/` exporting `language: Language` from its `index.ts`. `lib/i18n/registry.ts` is the only place that knows the full set; `LANGUAGE_CODES`, `LANGUAGE_META`, and `getLanguage` are derived. The Zod schemas in actions use `z.record(z.string(), …).refine(keys ⊂ LANGUAGE_CODES)` because Zod 4 makes `z.record(z.enum([...]), …)` exhaustive. Translatable text uses the pattern: plain `name`/`description` text columns are the source of truth for the restaurant's `defaultLanguage`; sibling jsonb `*I18n` columns carry overrides for non-default languages. Fallback chain at render time: requested → default → empty. New languages: see `/add-language` skill.

11. **Plans live in a registry.** Same shape as languages and templates: each plan is a folder under `lib/plans/<code>/` exporting `plan: Plan` from `index.ts`; `lib/plans/registry.ts` derives `PLAN_CODES`, `PLANS`, `getPlan`. Adding a plan = new folder + new literal in `PlanCode` union + new registry entry. Gates use `canAddRestaurant(orgId)` (returns structured `{ ok, reason, limit }` — never throws) and `planHas(plan, feature)`. The DB column `organization.plan` stores raw text; `getPlan` coerces unknown values back to the default so a renamed plan never crashes a render.

12. **Public menu is cached, invalidated by tag.** `loadRestaurantSnapshot(slug)` and `loadRestaurantAdminMenus(slug)` in `lib/menu/cached.ts` wrap `unstable_cache` with a per-slug tag `restaurant:${slug}`. Every mutation that affects the restaurant's public or admin view MUST call `revalidateRestaurant(slug)` (which uses `updateTag` for read-your-own-writes semantics, not `revalidateTag`). The single chokepoint is enforced — never call `revalidatePath('/r/${slug}')` from a mutation action; the cache tag is what matters. **Date gotcha:** `unstable_cache` JSON-serializes Dates to ISO strings; if a cached function returns a Date the caller will see a string. Hydrate explicitly in the loader (see `loadRestaurantAdminMenus`).

13. **View tracking is beacon-based, not server-render-coupled.** `/api/track/[slug]` is a pixel-beacon route that lives outside the cached snapshot — it runs on every public visit, even when the page itself is served from cache. Dedup is `(visitor_cookie, restaurant_id, hour_bucket)` via `view_seen.onConflictDoNothing`; only newly-inserted rows trigger `incrementDailyView`. Bot UAs filtered at the route. **Never put the view increment back inline in the page** — that breaks the moment a CDN sits in front.

## File layout
```
app/
  (auth)/                public auth pages (signup, login)
  dashboard/             admin pages — protected
    analytics/           Casa-only KPIs + scan chart; redirects free → billing
    billing/             current plan + invoice ledger (year filter)
    r/[slug]/            restaurant home
      m/[menuId]/        dnd-kit menu builder
      theme/             settings: identity + theme editor
      qr/                QR code generator
    analytics-cards.tsx  KpiCard / ScansCard / ScansChart (shared by dashboard + analytics page)
  r/[slug]/              public menu page per restaurant — cached snapshot
  onboarding/            first-time org creation AND add-another-restaurant flow
  api/
    auth/[...all]/       Better Auth handler
    track/[slug]/        pixel-beacon view tracking endpoint (cookie dedup + bot filter)
lib/
  auth.ts                Better Auth server config
  auth-client.ts         Better Auth React client
  dal.ts                 verifySession + tenant-scoped guards
  utils.ts               shadcn cn() helper
  menu-themes.ts         ResolvedTheme defaults, FONTS; LAYOUTS derived from templates registry
  billing/
    dal.ts               getInvoicesForYear + getInvoiceYears (cached, year filter)
    index.ts             barrel
  dashboard/
    queries.ts           dashboard aggregate queries (restaurants-with-counts etc.)
  i18n/                  per-language registry (en, pt, es, fr) + format helpers
  menu/
    cached.ts            loadRestaurantSnapshot + loadRestaurantAdminMenus (unstable_cache + per-slug tag) + revalidateRestaurant
    load-tree.ts         raw tree fetch + localizeTree (per-render reducer)
    sample-data.ts       seed payload for "Sample menu" button
  metrics/
    dal.ts               incrementDailyView + getOrganizationAnalytics + range helpers
    index.ts             barrel
  plans/                 plan registry (free, casa) — same pattern as i18n/templates
    free/index.ts        plan: Plan
    casa/index.ts        plan: Plan
    registry.ts          REGISTRY + getPlan + PLAN_CODES
    dal.ts               canAddRestaurant + planHas + getOrganizationPlan
    actions.ts           setOrganizationPlan (Stripe-free placeholder)
    types.ts             PlanCode, PlanFeature, PlanLimits, Plan
    index.ts             barrel
  db/
    index.ts             drizzle client
    schema.ts            all tables — single source of truth
  storage/               S3-compatible storage adapter (LocalStack dev/CI, R2/S3 in prod)
    targets.ts           constraints + tenant-prefixed key builder
    s3-storage.ts        AWS SDK v3 implementation
    bootstrap.ts         idempotent ensureBucket + public-read policy + CORS
    index.ts             getStorage() singleton wired from env
  upload/
    actions.ts           presign + commit + clear actions, DAL-guarded
components/
  ui/                    shadcn primitives
  editorial-list/        EditorialList + EditorialRow + StatusPill + ActionChip
  upload/
    image-upload.tsx     generic <ImageUpload target=...> reusable across all asset kinds
  i18n/
    localized-fields.tsx tabbed name+description editor used by item/category/identity dialogs
  menu/
    menu-renderer.tsx    consumes template registry; injects theme as CSS vars
    types.ts             PublicMenuData / RenderProps shared by all templates
    format.ts            price/i18n helpers used by templates
    templates/
      classic/           template module: classic-menu.tsx + meta.ts + index.ts
      minimal/           template module
      registry.ts        REGISTRY + getTemplate + TEMPLATE_META
proxy.ts                 Next 16 proxy (was middleware)
drizzle.config.ts
docker-compose.yml       postgres + redis + localstack
scripts/
  check-migrations.ts    dev-time guardrail; warns when journal has pending migrations
.github/workflows/
  ci.yml                 Typecheck + Lint + E2E (Playwright); Bun for installs, Node for build
.mcp.json                shadcn, postgres, bun, next-devtools, playwright MCP servers
tests/e2e/
  fixtures.ts            auto-fixture: fails fast on any RSC error / 5xx response
  specs/                 organized by module: auth, tenancy, menu-builder, public-menu,
                         settings, qr, uploads, plans, billing, metrics, dashboard, landing
  helpers/               shared signup/org/db utilities
```

## Useful commands
- `bun run dev` — Next.js dev server (Turbopack). Also warns at startup when migrations are pending.
- `bun run typecheck` — TS check without emit
- `bun run lint` — ESLint
- `bun run db:generate` — generate Drizzle migration from schema changes
- `bun run db:migrate` — apply pending migrations
- `bun run db:push` — push schema directly (dev only, no migration files)
- `bun run db:studio` — open Drizzle Studio
- `bun run auth:generate` — sync Better Auth tables into the schema (re-run after changing auth plugins)
- `bun run test:e2e` — Playwright suite (uses `bun run build && bun run start` locally; CI splits the build step out and runs it under Node)
- `docker compose up -d` — start Postgres + Redis + LocalStack (S3)
- `bunx shadcn@latest add <name>` — add a shadcn component

## CI
`.github/workflows/ci.yml` runs three jobs on every push and PR:
- **Typecheck** and **Lint** in parallel (Bun runtime).
- **E2E (Playwright)** with Postgres 18, Redis 7, and LocalStack as service containers. Build runs under Node (`node --run build`) because Bun + `next build` is unstable. Caches `.next/cache` and `~/.cache/ms-playwright`.

Branch protection: deliberately NOT enabled — solo, AI-driven project; the CI itself is the signal. Revisit when adding collaborators or after the first "broken main" incident.

## Where to look when unsure
1. `node_modules/next/dist/docs/` — bundled, version-matched Next.js docs
2. `node_modules/better-auth/` and the Better Auth README in node_modules — auth APIs
3. `node_modules/drizzle-orm/` — query builder, types

The bundled docs match installed versions — trust them over recall.
