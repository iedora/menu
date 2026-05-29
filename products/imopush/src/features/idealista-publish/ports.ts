/**
 * idealista-publish ports — boundaries with the outside world.
 *
 * Two effects:
 *   1. Read the property + write its idealista integrator status (store).
 *   2. Drive the Idealista web UI to publish a listing (publisher).
 *
 * Store methods are tenant-scoped — the caller passes the active
 * tenantId resolved by the auth slice.
 */

import type { Property } from '../properties'
import type { IntegratorState } from '../../shared/types/integrator'

export type IntegratorStatusUpsert = {
  state: IntegratorState
  publishedAt?: Date
  publishedUrl?: string
  lastError?: string
}

export interface PublishStore {
  getProperty(tenantId: string, reference: string): Promise<Property | null>
  upsertIdealistaStatus(
    tenantId: string,
    reference: string,
    status: IntegratorStatusUpsert,
  ): Promise<void>
}

export type PublishResult =
  | { ok: true; publishedUrl?: string }
  | { ok: false; error: string }

export interface IdealistaPublisher {
  publish(property: Property): Promise<PublishResult>
}
