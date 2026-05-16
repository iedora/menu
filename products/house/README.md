# iedora.com

Root page of `iedora.com`. Static, self-contained.

Not part of the Next.js menu app (which lives at `menu.iedora.com`). This site
is a single landing page: editorial header that doubles as a contact form,
four scroll-pinned "About" rooms, one scroll-pinned "Works" section pointing
at `menu.iedora.com`.

## Layout

```
products/house/
├── README.md           you are here
├── site/               deployable assets — what wrangler uploads
│   └── index.html
└── infra/              Tofu root + justfile (NOT shipped to Pages)
    ├── justfile        `just house::deploy` lives here
    ├── tofu/           Pages project + apex DNS + narrow deploy token
    └── bin/with-secrets BWS env wrapper
```

The `site/` subdir is what wrangler points at. The `infra/` tree never gets
uploaded — see `infra/tofu/iedora.tf` for the reason.

## Serve locally

    bunx serve products/house/site

Or open `products/house/site/index.html` directly in a browser.

## Deploy

From the repo root:

    just house::deploy

That runs `tofu apply` in `products/house/infra/tofu/` (idempotent — Cloudflare
Pages project + apex DNS + the narrow `pages_deploy` token), then
`wrangler pages deploy ../site` under the workload-scoped token Tofu just
provisioned (never the bootstrap CF token).

### URLs after a deploy

Cloudflare Pages always creates `iedora-com.pages.dev` (project alias) and a
per-deploy `<hash>.iedora-com.pages.dev` URL alongside the custom domain, and
it doesn't let you disable them (see `infra/tofu/iedora.tf`). To keep
`iedora.com` as the only effective URL, an account-level **Bulk Redirect**
(`infra/tofu/redirect.tf`) 301's every pages.dev hit at the apex:

| URL | What happens |
|---|---|
| `iedora.com/*` | Serves the site |
| `iedora-com.pages.dev/*` | 301 → `iedora.com/*` (path + query preserved) |
| `<hash>.iedora-com.pages.dev/*` | 301 → `iedora.com/*` (matched by `include_subdomains`) |

So the dupe-URL "leak" is mostly cosmetic — anyone who finds the pages.dev
URL gets bounced, search engines see the permanent redirect, link equity
flows to the canonical domain.

## Design source

Generated from the Claude Design handoff bundle (`Iedora Studio Hub v2.html`).
Palette: paper beige `#EFE8DA`, sumi ink `#1A1815`, cinnabar `#B83A26`.
Type: Fraunces + JetBrains Mono.
