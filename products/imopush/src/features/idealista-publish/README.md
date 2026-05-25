# idealista-publish slice

Publishes a `Property` on idealista.pt by driving a real Chrome instance over
CDP. Pairs with the field-map in `adapters/field-map.ts` and mirrors the
working `scripts/idealista/fill-listing.cjs`.

## Public API

- `@/features/idealista-publish` — `IdealistaPublisher`, `PropertyIntegratorStore`, `PublishResult` types
- `@/features/idealista-publish/actions` — `publishToIdealista(reference)` server action
- `@/features/idealista-publish/ui/publish-idealista-button` — client trigger

## Architecture

- **`ports.ts`** — `IdealistaPublisher` + `PropertyIntegratorStore`.
- **`adapters/cdp-publisher.ts`** — Playwright-over-CDP implementation. Connects
  to a real Chrome on `IDEALISTA_CDP_URL` (default `http://localhost:9222`),
  walks the 3-step `/flow/novo-anuncio` form, uploads photos, submits, and
  captures the published listing URL.
- **`adapters/json-store.ts`** — reads the property from `fixtures/*.json` and
  writes the `integrators[]` row back into the same file.
- **`use-cases/publish-property.ts`** — orchestrates: read → publish → write
  status (success or failure).
- **`actions.ts`** — `'use server'` shell. Calls `updateTag(property:{ref})`.

## Runtime requirements

1. Chrome running with `--remote-debugging-port=9222` (a regular browser
   profile, NOT headless — DataDome/JA3 blocks headless instantly).
2. The user is logged in to idealista.pt in that profile.

Recommended boot:

```
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-imopush"
```

## Why not headless / why not API

See `products/imopush/RESEARCH.md` §3 and §5. Idealista blocks every headless
strategy at the TLS fingerprinting layer; there is no free publish API.
The XML-feed path (§6) is the production target; this CDP adapter unblocks
local agency use today.
