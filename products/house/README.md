# iedora.com

Root page of `iedora.com`. Static, self-contained.

Not part of the Next.js menu app (which lives at `menu.iedora.com`). This is
an **Astro** site that consumes `@iedora/design-system` — the same primitives
and tokens menu uses — and renders everything to plain HTML at build time.
Zero JS ships to the browser.

Deploys to **Cloudflare Workers Static Assets** (the successor to Pages,
deprecated April 2025), fully declaratively: one `tofu apply` uploads the
`dist/` directory, reconciles the worker script, binds `iedora.com` as a
custom domain, and provisions the TLS cert. No wrangler in the deploy
path — the `cloudflare/cloudflare` Terraform provider v5.11+ implements
Cloudflare's `assets-upload-session` API directly.

## Layout

```
products/house/
├── README.md           you are here
├── astro.config.mjs    static output → dist/, React integration, port 3002
├── package.json        astro + @astrojs/react + workspace dep on design-system
├── tsconfig.json       extends astro/tsconfigs/strict
├── src/
│   ├── pages/index.astro       composes the home page
│   ├── layouts/BaseLayout.astro html/head shell, Google Fonts
│   ├── components/             HouseHeader, HouseWorks, HouseFooter
│   └── styles/global.css       imports @iedora/design-system/styles.css
├── dist/                       build output — what Tofu uploads to CF
├── site-legacy/                the previous 1789-line static site, kept for ref
└── infra/                      Tofu root + justfile (NOT shipped to CF)
    ├── justfile        `task up` lives here (run from products/house/infra/)
    └── tofu/           cloudflare_workers_script + cloudflare_workers_custom_domain
                        BWS env hydration comes from infra/bin/with-secrets (one wrapper)
```

## Develop locally

From the repo root:

    cd products/house && bun run dev          # :3002, HMR
    cd products/house && bun run build        # → dist/
    cd products/house && bun run preview      # serve dist/ at :3002
    cd products/house && bun run typecheck    # astro check

## Deploy

CI handles it on push to main (`.github/workflows/house-deploy.yml`). For ad-hoc local deploys:

    cd products/house/infra && just deploy

That recipe runs:

1. `bun run build` from `products/house/` → `dist/`
2. `tofu apply` in `products/house/infra/tofu/`. The provider scans
   `dist/`, hashes every file, opens an `assets-upload-session` against
   Cloudflare, uploads changed files in parallel, then reconciles the
   `cloudflare_workers_script.house` + `cloudflare_workers_custom_domain.apex`
   resources. Idempotent — unchanged files skip upload.

Same recipe runs in CI on every push that touches `products/house/**`
(see `.github/workflows/house-deploy.yml`).

## Why Workers, not Pages

Cloudflare deprecated Pages in April 2025. Workers Static Assets reached
feature parity for static sites with custom domains in early 2026, and the
Terraform provider got native directory uploads in v5.11 (Oct 2025) — which
removed the last reason to keep wrangler in the deploy path.

## Rendering model — static, with a clear escape hatch

`astro.config.mjs` is pinned at `output: 'static'`. Every byte ships as a
prebuilt asset; the Worker `content` is a 1-line 404 stub that never runs
in steady state — Cloudflare's edge serves `dist/404.html` directly when
no file matches. No request to `iedora.com` invokes server code.

If a single component ever needs dynamic data (latest works pulled from
an API, geo-aware copy, an A/B headline), reach for **Astro Server
Islands** — not full SSR:

1. `bun add -D @astrojs/cloudflare` in `products/house/`.
2. In `astro.config.mjs`:
   ```js
   import cloudflare from '@astrojs/cloudflare';
   export default defineConfig({
     output: 'static',
     adapter: cloudflare(),    // unlocks the island runtime
     integrations: [react()],
   });
   ```
3. Mark just the dynamic component with `server:defer`:
   ```astro
   <LatestWork server:defer>
     <Fragment slot="fallback">Loading…</Fragment>
   </LatestWork>
   ```
4. Replace the 404 stub in `iedora.tf` with the path Astro emits
   (`./dist/_worker.js/index.js`).

Result: every other route still serves from the edge with zero Worker
invocations; only the island fragment hits the Worker.

## Design source

Built from `@iedora/design-system` (`packages/design-system/`). Palette and
type follow the Iedora Manual: paper beige `#EFE8DA`, sumi ink `#1A1815`,
cinnabar `#B83A26`; Fraunces + JetBrains Mono.

`site-legacy/index.html` is the pre-Astro standalone HTML, retained for A/B
visual comparison while the new build settles in.
