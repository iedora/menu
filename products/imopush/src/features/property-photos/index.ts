/**
 * Public API of the property-photos slice.
 *
 * Server actions live at `@/features/property-photos/actions` (Next 'use server'
 * rules don't traverse barrels reliably). The `<PropertyPhotoUpload>` client
 * component lives at `@/features/property-photos/ui/property-photo-upload`.
 */
export type { PropertyStore } from './ports'
export type { AssetTarget, AssetTargetKind, UploadConstraints } from './types'
export { TARGET_CONSTRAINTS, buildKey, extensionForMime } from './targets'
