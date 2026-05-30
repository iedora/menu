import { plan as casaPlan } from './casa'
import { plan as freePlan } from './free'
import type { Plan, PlanCode } from './types'

/**
 * Closed inventory of menu plans. Adding a plan = new file + new
 * entry here + extra literal in `PlanCode`. The DAL, UI, and i18n
 * consume only this registry — there is no other inventory of menu
 * plans anywhere.
 */
export const REGISTRY = {
  free: freePlan,
  casa: casaPlan,
} as const satisfies Record<PlanCode, Plan>

export const PLAN_CODES = Object.keys(REGISTRY) as PlanCode[]

export const PLANS: readonly Plan[] = Object.values(REGISTRY)

export const DEFAULT_PLAN: Plan = (() => {
  const def = PLANS.find((p) => p.isDefault)
  if (!def) throw new Error('No default menu plan defined in registry')
  return def
})()

/**
 * Coerces any string (raw DB value, URL param, …) into a known plan.
 * Unknown / null values fall back to the default so a renamed or
 * removed plan never crashes a server component.
 */
export function getPlan(code: string | null | undefined): Plan {
  if (code && code in REGISTRY) return REGISTRY[code as PlanCode]
  return DEFAULT_PLAN
}

export function isPlanCode(code: string): code is PlanCode {
  return code in REGISTRY
}
