import 'server-only'
import { db } from '../../../shared/db/client'
import { integratorStatus } from '../../../shared/db/schema'
import { drizzlePropertiesGateway } from '../../properties/adapters/drizzle'
import type { PublishStore } from '../ports'

export const drizzlePublishStore: PublishStore = {
  getProperty: (tenantId, reference) =>
    drizzlePropertiesGateway.getByReference(tenantId, reference),

  async upsertIdealistaStatus(tenantId, reference, status) {
    await db
      .insert(integratorStatus)
      .values({
        tenantId,
        propertyReference: reference,
        integratorKey: 'idealista',
        state: status.state,
        publishedAt: status.publishedAt ?? null,
        publishedUrl: status.publishedUrl ?? null,
        lastError: status.lastError ?? null,
      })
      .onConflictDoUpdate({
        target: [integratorStatus.propertyReference, integratorStatus.integratorKey],
        set: {
          state: status.state,
          publishedAt: status.publishedAt ?? null,
          publishedUrl: status.publishedUrl ?? null,
          lastError: status.lastError ?? null,
        },
      })
  },
}
