# House — `products/house/`

The iedora.com root brand site. Astro static output, deployed to Cloudflare Workers Static Assets. Deliberately small — no DB, no auth.

No code-level hard rules. If you ever need server-side behaviour, use Astro Server Islands rather than full SSR (preserves edge cache hit ratio).

See:
- `products/house/README.md` — what it is + how to deploy.
- `products/house/infra/justfile` — `deploy` recipe (Astro build + `tofu apply`; the Cloudflare TF provider 5.11+ uploads `dist/` natively, no wrangler). Run via `cd products/house/infra && just deploy`. CI does this on push to main.
