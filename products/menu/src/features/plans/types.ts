/**
 * Plan type contract for menu. The definitions LIVE in
 * `@iedora/billing/products/menu` because pricing is a billing
 * concern owned cross-product. This file is a thin re-export so
 * existing slice-local imports keep working without dragging the
 * deep path through every caller.
 *
 * New menu code should prefer `import { ... } from
 * '@iedora/billing/products/menu'` directly.
 */
export type {
  Plan,
  PlanCode,
  PlanFeature,
  PlanLimits,
} from '@iedora/billing/products/menu'
