# property-photos slice

Manages photo uploads and persistence for real-estate properties.

## Public API

- `@/features/property-photos` — `PropertyStore` port, asset targets, types
- `@/features/property-photos/actions` — `requestPhotoUploadUrl`, `commitPhoto`, `clearPhoto` server actions
- `@/features/property-photos/ui/property-photo-upload` — `<PropertyPhotoUpload>` client component

## Architecture

Follows the vertical-slice + light-hexagonal pattern from `docs/agents/slice-pattern.md`.

- **`ports.ts`** — `PropertyStore` interface. Today backed by JSON fixtures; tomorrow by Drizzle.
- **`adapters/storage.ts`** — thin wrapper that binds `@iedora/storage` (S3/R2/MinIO).
- **`adapters/json-store.ts`** — reads/writes `photoUrls` inside the fixture JSON files.
- **`use-cases/`** — pure-ish functions taking the port as first arg.
- **`actions.ts`** — `'use server'` shells (no auth yet — imopush is pre-auth).

## Asset targets

`property-photo` — tenant-prefixed key `p/{propertyReference}/photos/{slug}.{ext}`.
No DB row yet; the canonical state is the fixture JSON file.
