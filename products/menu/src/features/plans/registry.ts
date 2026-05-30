/**
 * Re-export of the menu plan registry, which lives in
 * `@iedora/billing/products/menu`. Slice-local imports continue to
 * resolve via this file; new code may import from billing directly.
 */
export {
  DEFAULT_PLAN,
  PLANS,
  PLAN_CODES,
  REGISTRY,
  getPlan,
  isPlanCode,
} from '@iedora/billing/products/menu'
