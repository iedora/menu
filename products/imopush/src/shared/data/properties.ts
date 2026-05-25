/**
 * Runtime property shape used across the UI + slices. Built on top of the
 * canonical `UnifiedProperty` in `@/shared/types/unified-property` — the
 * single source of truth for property fields.
 *
 * `Property` adds the integrator-status array, which is runtime state and
 * does not belong in the platform-agnostic canonical type.
 */

import type {
  UnifiedProperty,
  PropertyType,
  OperationType,
} from '@/shared/types/unified-property'

export type { PropertyType, OperationType }

export type IntegratorStatus = {
  key: string
  status: 'published' | 'failed' | 'idle' | 'publishing'
  publishedAt?: string
  publishedUrl?: string
  lastError?: string
}

export type Property = Omit<UnifiedProperty, 'reference'> & {
  /** Internal reference — required at the UI layer (drives URLs + persistence). */
  reference: string
  /** Publication status per integrator. */
  integrators?: IntegratorStatus[]
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function formatTypePT(type: PropertyType): string {
  const map: Record<PropertyType, string> = {
    apartment: 'Apartamento',
    house: 'Moradia',
    country_house: 'Quinta / Herdade',
    room: 'Quarto',
    office: 'Escritório',
    commercial: 'Comercial',
    garage: 'Garagem',
    land: 'Terreno',
    storage: 'Arrecadação',
    building: 'Edifício',
    vacation_rental: 'Alojamento Local',
  }
  return map[type] ?? type
}

export function formatOperationPT(op: OperationType): string {
  return op === 'sale' ? 'Venda' : 'Arrendamento'
}
