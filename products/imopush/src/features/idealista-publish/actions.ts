'use server'

import { revalidatePath } from 'next/cache'
import { IMOPUSH_PATHS } from '../../url'
import { requireActiveOrganization } from '../auth'
import { createCdpIdealistaPublisher } from './adapters/cdp-publisher'
import { drizzlePublishStore } from './adapters/drizzle-store'
import { publishProperty } from './use-cases/publish-property'
import type { PublishResult } from './ports'

export async function publishToIdealista(reference: string): Promise<PublishResult> {
  const { tenantId } = await requireActiveOrganization()
  const result = await publishProperty(
    { publisher: createCdpIdealistaPublisher(), store: drizzlePublishStore },
    tenantId,
    { reference },
  )
  revalidatePath(IMOPUSH_PATHS.property(reference))
  revalidatePath(IMOPUSH_PATHS.dashboard)
  return result
}
