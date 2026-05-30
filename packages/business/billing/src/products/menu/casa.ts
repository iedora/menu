import type { Plan, PlanFeature } from './types'

export const plan: Plan = {
  code: 'casa',
  englishName: 'Casa',
  monthlyCents: 1000,
  limits: {
    restaurants: Number.POSITIVE_INFINITY,
    monthlyViews: Number.POSITIVE_INFINITY,
    aiMenuGenerationsPerWeek: 5,
  },
  features: new Set<PlanFeature>(['exportPdf', 'customBranding', 'analytics']),
  isDefault: false,
  isRecommended: true,
}
