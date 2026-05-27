# Tech debt queue

Real cleanup items — things that work but could be more idiomatic /
less repetitive / more aligned with industry standards. None of these
are bugs; none block product work. Order is rough priority.

Tag legend:
- **size:** S (< 1h), M (< 1 day), L (multi-day)
- **risk:** low / med / high (chance of breaking something during cleanup)

---

## CI / GitHub Actions

### CI-1: BWS install + GHCR login boilerplate duplicated across workflows
**size:** S · **risk:** low

The 8-line "Install bws CLI" + 7-line "Log in to GHCR" patterns repeat
across `web.yml` + `infra-deploy.yml` (×2 jobs after consolidation) +
`deploy.yml` + `app-state.yml`. ~50 lines of repetition. Adding a new
workflow that needs BWS access copies the same snippets again.

Fix: composite actions at
- `.github/actions/install-bws/action.yml` (input: BWS_ACCESS_TOKEN)
- `.github/actions/ghcr-login/action.yml` (uses install-bws)

### CI-2: SSH key write boilerplate duplicated across 3 workflows
**size:** S · **risk:** low

The 7-line block that writes `IAC_BOOTSTRAP_SSH_PRIVATE_KEY` to
`~/.ssh/id_ed25519` + adds the agent appears in `infra-deploy.yml`,
`app-state.yml`, `deploy.yml`. Same fix as CI-1: composite action.

### CI-3: web.yml has 76 lines of inline shell in `run:` blocks
**size:** M · **risk:** low

Polling loops + bws-fetch + multi-step build orchestration grew
inline. Extract to `.github/scripts/wait-app-state.sh` or composite
actions. `app-state.yml`, `deploy.yml`, `infra-deploy.yml` have
similar but smaller blocks (30-40 each).

### CI-4: cross-workflow gating via `gh run list` polling
**size:** L · **risk:** med

`web.yml::wait_app_state` polls `gh run list --workflow=app-state.yml`
because GHA doesn't support cross-workflow `needs:` when each
workflow has independent triggers. Workaround works but is fragile
(timeout window, race conditions on retries).

True fix: re-architect so the whole pipeline is ONE workflow_call
chain from a single entrypoint (e.g. a `release.yml`
workflow_dispatch). Bigger refactor; defer until pipeline complexity
justifies it.

---

## TypeScript / monorepo

### TS-1: Composite TS project references only on `products/menu`
**size:** M · **risk:** med

`products/menu` is the only workspace using `composite: true` +
`emitDeclarationOnly: true` because it was the only one with internal
`@/` paths (now removed, but composite is the proper monorepo
shape regardless). Other workspaces (packages/auth, packages/db,
products/core, etc.) still use plain `tsc --noEmit`.

Going composite for all: each workspace gets `tsconfig.json` with
composite settings + apps/web declares full `references:` list.
Benefits: incremental + cached typecheck, true .d.ts boundaries.
Cost: per-workspace `dist/`, more moving pieces.

Defer unless typecheck speed becomes a real annoyance.

### TS-2: Per-workspace script naming inconsistency
**size:** S · **risk:** low

Lint scripts: most workspaces use `eslint src` but `products/menu`
and `apps/web` just use `eslint` (which picks up scope from
`eslint.config.mjs`). Functionally identical, just style drift.

Test scripts: mix of `vitest run` and `vitest run --passWithNoTests`.
The `--passWithNoTests` flag is correct for workspaces that don't
have tests yet — but ideally a CI-level convention (workflow checks
if test files exist before invoking).

### TS-3: No root-level orchestrator scripts
**size:** S · **risk:** low

`package.json` at root has an empty `"scripts": {}`. Want to typecheck
the whole monorepo? Loop per-workspace via shell. A root `typecheck`
script (or proper task runner like Turborepo / Nx / Bun's recent
task primitive) would centralize "run X across every workspace".

For now, CI has per-workspace jobs which serves the same goal.

### TS-4: drizzle-orm version pinned in 4 workspaces independently
**size:** S · **risk:** low

`packages/auth`, `packages/db`, `products/menu`, `products/imopush`
each declare `"drizzle-orm": "^0.45.2"`. If one drifts, weird type
mismatches. Bun's recent `catalog:` feature (or pnpm's catalog)
would let us declare the version once at workspace root and
reference it per-package.

---

## Code-level

### CODE-1: TODO in restaurant-identity actions
**size:** S · **risk:** low

`products/menu/src/features/restaurant-identity/actions.ts:78` has a
`TODO(language-switch-ui)` about surfacing a count to the UI. Real
product task, not architecture; tracked as code, not on a backlog.

---

## Anti-debt (things that LOOK like hacks but aren't, documented for clarity)

- **`apps/web/public/.gitkeep`** — canonical solution for tracking an
  empty directory (git can't track dirs natively). Standard, not a hack.
- **`*.tsbuildinfo` in `.gitignore`** — tsc incremental output;
  excluding from source control is correct.
- **`menu_database_url` / `menu_public_url` in Tofu outputs** —
  describe the resource (postgres DB named `menu`, URL
  `menu.iedora.com`), not the consumer. Renaming would be wrong.
- **Per-product `MENU_PUBLIC_URL` env var in web container** — the
  menu-subdomain URL is genuinely menu-specific even though it's
  read by the unified `web` container.
- **`products/menu/tsconfig.tests.json` non-composite** — tests +
  configs include files outside `src/` (drizzle.config, vitest.config,
  instrumentation.ts) that composite mode would refuse. Non-composite
  for tests is the right shape.
- **`MENU_IMAGE_SHA` → `IMAGE_SHA` env name** — already cleaned up.
  Carrying the rename across BWS keys would be next-level overkill
  (no consumer reads from BWS for this).
