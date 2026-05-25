'use server'

import { updateTag } from 'next/cache'
import { createCdpIdealistaPublisher } from './adapters/cdp-publisher'
import { createJsonPropertyIntegratorStore } from './adapters/json-store'
import { publishProperty as runPublishProperty } from './use-cases/publish-property'

type Result =
  | { ok: true; publishedUrl?: string }
  | { ok: false; error: string }

export async function publishToIdealista(reference: string): Promise<Result> {
  const publisher = createCdpIdealistaPublisher()
  const store = createJsonPropertyIntegratorStore()

  const result = await runPublishProperty({ publisher, store }, { reference })
  updateTag(`property:${reference}`)
  updateTag('properties:all')
  return result
}
