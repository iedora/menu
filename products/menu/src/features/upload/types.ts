import type {
  Storage,
  PresignedUpload,
  PresignedUploadRequest,
  StoredObject,
  StorageError,
} from '@iedora/storage'

export type {
  Storage,
  PresignedUpload,
  PresignedUploadRequest,
  StoredObject,
  StorageError,
}

// Asset target — every uploadable thing in the app maps to one of these.
// Adding a new target means: extend this union, add a TARGET_CONSTRAINTS entry
// in targets.ts, and add a `commitAsset` branch in the upload action.
export type AssetTargetKind =
  | 'restaurant-logo'
  | 'restaurant-banner'
  | 'item-photo'
  | 'menu-import-photo'

export type AssetTarget =
  | { kind: 'restaurant-logo'; restaurantId: string }
  | { kind: 'restaurant-banner'; restaurantId: string }
  | { kind: 'item-photo'; restaurantId: string; itemId: string }
  | { kind: 'menu-import-photo'; restaurantId: string }

export type UploadConstraints = {
  maxBytes: number
  acceptedMimeTypes: readonly string[]
  recommended?: { width: number; height: number; aspectLabel: string }
}
