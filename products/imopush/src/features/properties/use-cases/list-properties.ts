import type { PropertiesGateway } from '../ports'

export async function listProperties(gateway: PropertiesGateway, tenantId: string) {
  return gateway.list(tenantId)
}
