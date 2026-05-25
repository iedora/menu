import 'server-only'
import { z } from 'zod'
import { StorageError, type PresignedUpload, type Storage } from '@iedora/storage'
import { TARGET_CONSTRAINTS, buildKey } from '../targets'

const targetSchema = z.object({
  kind: z.literal('property-photo'),
  propertyReference: z.string().min(1),
})

const inputSchema = z.object({
  target: targetSchema,
  contentType: z.string().min(1),
  contentLengthBytes: z.number().int().positive(),
})

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Presign a browser PUT URL for a property photo.
 *
 * Validates file constraints, builds a tenant-prefixed key
 * (`p/{propertyReference}/photos/...`), and asks the storage port for a
 * presigned PUT.
 */
export async function presignPhoto(
  deps: { storage: Storage },
  raw: unknown,
): Promise<Result<PresignedUpload>> {
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { target, contentType, contentLengthBytes } = parsed.data

  const constraints = TARGET_CONSTRAINTS['property-photo']
  if (!constraints.acceptedMimeTypes.includes(contentType)) {
    return {
      ok: false,
      error: `Unsupported file type. Allowed: ${constraints.acceptedMimeTypes.join(', ')}`,
    }
  }
  if (contentLengthBytes > constraints.maxBytes) {
    return {
      ok: false,
      error: `File too large. Max ${(constraints.maxBytes / (1024 * 1024)).toFixed(0)} MB.`,
    }
  }

  const key = buildKey(target, contentType)
  try {
    const upload = await deps.storage.presignPut(key, {
      contentType,
      contentLengthBytes,
    })
    return { ok: true, data: upload }
  } catch (err) {
    const msg = err instanceof StorageError ? err.message : 'Presign failed'
    return { ok: false, error: msg }
  }
}
