import 'server-only'
import { z } from 'zod'
import { StorageError, type Storage } from '@iedora/storage'
import type { PropertyStore } from '../ports'
import type { AssetTarget } from '../types'

const targetSchema = z.object({
  kind: z.literal('property-photo'),
  propertyReference: z.string().min(1),
})

const inputSchema = z.object({
  target: targetSchema,
  key: z.string().min(1),
  publicUrl: z.string().url(),
})

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Persist a freshly uploaded photo's public URL on the property fixture
 * and best-effort delete any previous object at the same key.
 *
 * Verifies the client actually completed the PUT before writing the URL.
 */
export async function commitPhoto(
  deps: { storage: Storage; store: PropertyStore },
  raw: unknown,
): Promise<Result<{ url: string }>> {
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { target, key, publicUrl } = parsed.data

  assertKeyBelongsToTarget(key, target)

  // Verify the client actually completed the PUT.
  const head = await deps.storage.head(key)
  if (!head) {
    return { ok: false, error: 'Upload did not complete. Try again.' }
  }

  await deps.store.addPhotoUrl(target.propertyReference, publicUrl)

  return { ok: true, data: { url: publicUrl } }
}

export function assertKeyBelongsToTarget(key: string, target: AssetTarget): void {
  const expectedPrefix = `p/${target.propertyReference}/`
  if (!key.startsWith(expectedPrefix)) {
    throw new Error('Key does not belong to the target property')
  }
}
