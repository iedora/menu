import 'server-only'
import { cache } from 'react'
import { drizzlePropertiesGateway } from './adapters/drizzle'
import { listProperties as runListProperties } from './use-cases/list-properties'
import { getProperty as runGetProperty } from './use-cases/get-property'
import { requireActiveOrganization } from '../auth'

/**
 * Tenant-bound reads. Resolve the active tenant via the auth slice once
 * per render (`requireActiveOrganization` redirects unauth'd / unscoped
 * callers) then delegate to the use-case with the tenantId argument.
 */
export const listProperties = cache(async () => {
  const { tenantId } = await requireActiveOrganization()
  return runListProperties(drizzlePropertiesGateway, tenantId)
})

export const getProperty = cache(async (reference: string) => {
  const { tenantId } = await requireActiveOrganization()
  return runGetProperty(drizzlePropertiesGateway, tenantId, reference)
})

export type { Property, PropertyListRow, PropertiesGateway } from './ports'
export { formatPrice, formatTypePT, formatOperationPT } from './format'
