/**
 * Public API of the restaurant-identity slice.
 *
 * Server actions live at `@/features/restaurant-identity/actions` (Next
 * 'use server' rules don't traverse barrels reliably). The client UI lives
 * at `@/features/restaurant-identity/ui/*` and is imported directly.
 */
export type { IdentityWritePort } from './ports'
export { listRestaurantsCrossTenant } from './use-cases/list-restaurants-cross-tenant'
export { listRestaurantsAdmin } from './use-cases/list-restaurants-admin'
export {
  getRestaurantTransferContext,
  type TransferContext,
  type TransferContextMember,
} from './use-cases/get-transfer-context'
export { getLanguageConfig } from './use-cases/get-language-config'
export {
  getThemeEditorData,
  type ThemeEditorRestaurantRow,
} from './use-cases/get-theme-editor-data'
export {
  transferRestaurant,
  type TransferRestaurantInput,
  type TransferRestaurantResult,
} from './use-cases/transfer-restaurant'
