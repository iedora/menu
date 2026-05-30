/**
 * Menu-product audit event taxonomy. Mirrors the shape of
 * `CORE_AUDIT_EVENTS` in `@iedora/auth/audit` and `BILLING_AUDIT_EVENTS`
 * in `@iedora/billing/literals` — `<resource>.<verb-past-tense>`,
 * namespaced by the menu product so the timeline filter knows where
 * each row came from.
 *
 * Framework-free. Pure data. Imported by emitters + tests + the (future)
 * admin timeline filter UI.
 */
export const MENU_AUDIT_EVENTS = {
  RESTAURANT_TRANSFERRED: 'menu.restaurant.transferred',
} as const

export type MenuAuditEvent =
  (typeof MENU_AUDIT_EVENTS)[keyof typeof MENU_AUDIT_EVENTS]
