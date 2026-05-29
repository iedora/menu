import type { PropertiesGateway } from '../ports'

export async function getProperty(
  gateway: PropertiesGateway,
  tenantId: string,
  reference: string,
) {
  if (!reference) return null
  return gateway.getByReference(tenantId, reference)
}
