/**
 * idealista-publish ports — boundaries with the outside world.
 *
 * Two effects:
 *   1. Read the property + write its idealista integrator status (storage).
 *   2. Drive the Idealista web UI to publish a listing (publisher).
 */

import type { Property, IntegratorStatus } from '@/shared/data/properties'

export interface PropertyIntegratorStore {
  getProperty(reference: string): Promise<Property | null>
  setIntegratorStatus(reference: string, status: IntegratorStatus): Promise<void>
}

export type PublishResult =
  | { ok: true; publishedUrl?: string }
  | { ok: false; error: string }

export interface IdealistaPublisher {
  publish(property: Property): Promise<PublishResult>
}
