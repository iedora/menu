---
name: add-asset-target
description: Use when adding a new uploadable asset type to the app (e.g. category banner, restaurant favicon, QR sticker). Encodes the contract enforced by hard rule #9 — every asset target gets tenant-prefixed keys, validated constraints, and DAL-guarded actions sharing the same Storage interface.
---

# add-asset-target

Hard rule #9 from `AGENTS.md`: asset keys are tenant-prefixed and verified twice. New targets MUST follow the same `r/{restaurantId}/...` scheme and route through `requireRestaurantAccess` + `assertKeyBelongsToTarget`.

## Five touch points

### 1. Extend the target union
In `lib/storage/types.ts`:
```ts
export type AssetTargetKind = 'restaurant-logo' | 'restaurant-banner' | 'item-photo' | 'category-banner'
export type AssetTarget =
  | { kind: 'restaurant-logo'; restaurantId: string }
  | ...
  | { kind: 'category-banner'; restaurantId: string; categoryId: string }
```

### 2. Declare constraints + key shape
In `lib/storage/targets.ts`:
```ts
export const TARGET_CONSTRAINTS: Record<AssetTargetKind, UploadConstraints> = {
  ...,
  'category-banner': {
    maxBytes: 4 * 1024 * 1024,
    acceptedMimeTypes: IMAGE_MIME,
    recommended: { width: 1400, height: 400, aspectLabel: 'wide' },
  },
}

export function buildKey(target: AssetTarget, mime: string): string {
  switch (target.kind) {
    ...
    case 'category-banner':
      return `r/${target.restaurantId}/categories/${target.categoryId}/banner-${randomSlug()}.${extensionForMime(mime)}`
  }
}
```
The key MUST start with `r/${target.restaurantId}/` — `assertKeyBelongsToTarget` is the second layer of defense and depends on this prefix.

### 3. Wire the action branches
In `lib/upload/actions.ts`:
- Extend `targetSchema` with the new discriminator.
- Add a `case 'category-banner':` to both `readCurrentAssetUrl` and `writeAssetUrl`.
- If the new target is item-scoped (or category-scoped, etc.), add an ownership check alongside `assertItemBelongsToRestaurant` and call it in `requestUploadUrl` and `clearAsset`.

### 4. Wire the UI
Drop `<ImageUpload>` wherever the user edits the parent record:
```tsx
<ImageUpload
  target={{ kind: 'category-banner', restaurantId, categoryId }}
  currentUrl={category.bannerUrl}
  label="Category banner"
  onChange={(url) => { /* update local state + router.refresh() */ }}
/>
```
The component is generic — no edits to `components/upload/image-upload.tsx`.

### 5. Persist + render
- Add the `bannerUrl` column (or equivalent) to the relevant table in `lib/db/schema.ts`.
- Run `bun run db:generate` then `bun run db:migrate`.
- Surface the URL in the relevant render path (`app/r/[slug]/page.tsx`, the templates, etc.).

## Tests

Add a spec under `tests/e2e/specs/uploads/` mirroring the existing logo/items specs:
- Upload + persist + render
- Replace deletes previous object
- Oversize rejection (client-side)
- Cross-tenant access on the page that hosts the upload (extends `tests/e2e/specs/tenancy/isolation.spec.ts`)

## Don't

- Don't bypass `requireRestaurantAccess` even for public-feeling assets — uploads are always authenticated.
- Don't hand-build keys outside `buildKey` — the prefix invariant is what makes `assertKeyBelongsToTarget` work.
- Don't store URLs as text the user types. The path is always: presign → PUT → commit. The text-input shape was removed for exactly this reason.
- Don't skip the bucket bootstrap. `getStorage()` already calls `ensureBucket` lazily — call `getStorage()`, never `new S3Storage()` directly.
