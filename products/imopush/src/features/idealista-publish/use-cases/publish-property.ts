import 'server-only'
import { z } from 'zod'
import type { IdealistaPublisher, PropertyIntegratorStore } from '../ports'

const inputSchema = z.object({
  reference: z.string().min(1),
})

type Result =
  | { ok: true; publishedUrl?: string }
  | { ok: false; error: string }

/**
 * Read the property → drive the Idealista publisher → write the integrator
 * status row back to storage. On failure, persists a `failed` row with the
 * error message so the UI can show it.
 */
export async function publishProperty(
  deps: { publisher: IdealistaPublisher; store: PropertyIntegratorStore },
  raw: unknown,
): Promise<Result> {
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { reference } = parsed.data

  const property = await deps.store.getProperty(reference)
  if (!property) return { ok: false, error: `Propriedade não encontrada: ${reference}` }

  await deps.store.setIntegratorStatus(reference, {
    key: 'idealista',
    status: 'publishing',
  })

  const result = await deps.publisher.publish(property)

  if (!result.ok) {
    await deps.store.setIntegratorStatus(reference, {
      key: 'idealista',
      status: 'failed',
      lastError: result.error,
    })
    return { ok: false, error: result.error }
  }

  await deps.store.setIntegratorStatus(reference, {
    key: 'idealista',
    status: 'published',
    publishedAt: new Date().toISOString(),
    publishedUrl: result.publishedUrl,
  })

  return { ok: true, publishedUrl: result.publishedUrl }
}
