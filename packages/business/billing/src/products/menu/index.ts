/**
 * Menu product plan surface — pure data, no I/O. Consumed by:
 *   - `products/menu/features/plans` for its use-cases
 *     (canAddRestaurant, canGenerateAiMenu, planHas, …)
 *   - `@iedora/billing/plans` to seed the cross-product catalogue
 *     iterated by the admin payments page
 *
 * Framework-free — safe in server, client, tests.
 */
export type { Plan, PlanCode, PlanFeature, PlanLimits } from './types'
export {
  DEFAULT_PLAN,
  PLANS,
  PLAN_CODES,
  REGISTRY,
  getPlan,
  isPlanCode,
} from './registry'
