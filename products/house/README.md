# iedora.com

Root page of `iedora.com`. Static, self-contained.

Not part of the Next.js menu app (which lives at `menu.iedora.com`). This is
an **Astro** site that consumes `@iedora/design-system` — the same primitives
and tokens menu and genkan use — and renders everything to plain HTML at
build time. Zero JS ships to the browser. It deploys to **Cloudflare Workers
Static Assets** (the successor to Pages, which was deprecated April 2025).

## Layout

```
products/house/
├── README.md           you are here
├── astro.config.mjs    static output → dist/, React integration, port 3002
├── package.json        astro + @astrojs/react + workspace dep on design-system
├── tsconfig.json       extends astro/tsconfigs/strict
├── wrangler.toml       Cloudflare Worker config (name + assets dir + apex route)
├── src/
│   ├── pages/index.astro       composes the home page
│   ├── layouts/BaseLayout.astro html/head shell, Google Fonts
│   ├── components/             HouseHeader, HouseWorks, HouseFooter
│   └── styles/global.css       imports @iedora/design-system/styles.css
├── dist/                       build output — what wrangler uploads
├── site-legacy/                the previous 1789-line static site, kept for ref
└── infra/                      Tofu root + justfile (NOT shipped to Workers)
    ├── justfile        `just house::deploy` lives here
    ├── tofu/           ONE resource: the narrow workload deploy token
    └── bin/with-secrets BWS env wrapper
```

## Develop locally

From the repo root:

    cd products/house && bun run dev          # :3002, HMR
    cd products/house && bun run build        # → dist/
    cd products/house && bun run preview      # serve dist/ at :3002
    cd products/house && bun run typecheck    # astro check

## Deploy

From the repo root:

    just house::deploy

That sequences three steps:

1. `bun run build` from `products/house/` → `dist/`
2. `tofu apply` in `products/house/infra/tofu/` — idempotent; mints / refreshes
   the workload `cloudflare_api_token` (Workers Scripts: Edit + DNS: Edit).
3. `wrangler deploy` (run from `products/house/`, reads `wrangler.toml`) —
   uploads `dist/`, binds the apex domain `iedora.com` with
   `custom_domain = true` (Cloudflare auto-creates the DNS record + cert),
   and pins `workers_dev = false` so the site is only reachable at
   `iedora.com`.

### URLs after a deploy

`workers_dev = false` in `wrangler.toml` closes the `<worker>.workers.dev`
preview URL completely — `iedora.com` is the only entry point. The
Pages-era Bulk Redirect that bounced `*.pages.dev → iedora.com` is gone;
nothing leaks to redirect.

## Architecture note — why Workers, not Pages

Cloudflare deprecated Pages in **April 2025**. Workers Static Assets reached
feature parity for static sites with custom domains in **early 2026** and
is where every new Cloudflare deploy primitive lands first (or only). The
Astro build output already has the shape Workers Static Assets expects, so
the migration was minor: a new `wrangler.toml`, a much smaller Tofu root
(one resource down from five), and `wrangler deploy` instead of
`wrangler pages deploy`.

### Migrating an existing Pages-era deploy

If this repo was previously deployed via the Pages-era config (apex DNS +
Pages project + Bulk Redirect all in Tofu), do this once:

```
# On the old Pages-era files (or with the old state):
just house::destroy        # tears down Pages project + DNS + redirect

# Switch to these new files (or pull from main):
just house::deploy         # provisions worker + DNS + cert from scratch
```

Brief downtime between the two commands while DNS swaps from
`<project>.pages.dev` to the Workers route — fine since this is a brand
site with no transactional traffic.

## Design source

Built from `@iedora/design-system` (`packages/design-system/`). Palette and
type follow the Iedora Manual: paper beige `#EFE8DA`, sumi ink `#1A1815`,
cinnabar `#B83A26`; Fraunces + JetBrains Mono.

`site-legacy/index.html` is the pre-Astro standalone HTML, retained for A/B
visual comparison while the new build settles in.
