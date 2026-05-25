import 'server-only'
import { z } from 'zod'
import { StorageError, type Storage } from '@iedora/storage'
import type { PropertyStore } from '../ports'

const targetSchema = z.object({
  kind: z.literal('property-photo'),
  propertyReference: z.string().min(1),
})

const inputSchema = z.object({
  target: targetSchema,
  publicUrl: z.string().url(),
})

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Remove a photo URL from the property and delete the underlying object.
 *
 * Best-effort: if the object is already gone, deletion still succeeds.
 */
export async function clearPhoto(
  deps: { storage: Storage; store: PropertyStore },
  raw: unknown,
): Promise<Result<null>> {
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { target, publicUrl } = parsed.data

  const key = deps.storage.keyFromPublicUrl(publicUrl)

  await deps.store.removePhotoUrl(target.propertyReference, publicUrl)

  if (key) {
    try {
      await deps.storage.delete(key)
    } catch (err) {
      // Best-effort deletion; log but don't fail the action.
      if (err instanceof StorageError && err.message.includes('not found')) {
        // expected
      } else {
        console.error('Failed to delete storage object:', err)
      }
    }
  }

  return { ok: true, data: null }
}
