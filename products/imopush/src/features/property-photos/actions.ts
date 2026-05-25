'use server'

import { updateTag } from 'next/cache'
import { getPropertyPhotoStorage } from './adapters/storage'
import { createJsonPropertyStore } from './adapters/json-store'
import { presignPhoto as runPresignPhoto } from './use-cases/presign-photo'
import { commitPhoto as runCommitPhoto } from './use-cases/commit-photo'
import { clearPhoto as runClearPhoto } from './use-cases/clear-photo'
import type { PresignedUpload } from '@iedora/storage'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

function extractPropertyReference(input: unknown): string | null {
  if (
    input &&
    typeof input === 'object' &&
    'target' in input &&
    input.target &&
    typeof input.target === 'object' &&
    'propertyReference' in input.target &&
    typeof input.target.propertyReference === 'string'
  ) {
    return input.target.propertyReference
  }
  return null
}

/**
 * Server action shells — thin wrappers around use-cases.
 *
 * TODO: add auth gating once imopush has identity wired.
 * Today these are open because the product is pre-auth ("v0.1 · sem auth").
 */

export async function requestPhotoUploadUrl(
  input: unknown,
): Promise<Result<PresignedUpload>> {
  const storage = await getPropertyPhotoStorage()
  return runPresignPhoto({ storage }, input)
}

export async function commitPhoto(
  input: unknown,
): Promise<Result<{ url: string }>> {
  const storage = await getPropertyPhotoStorage()
  const store = createJsonPropertyStore()
  const result = await runCommitPhoto({ storage, store }, input)

  if (result.ok) {
    const reference = extractPropertyReference(input)
    if (reference) {
      updateTag(`property:${reference}`)
    }
  }

  return result
}

export async function clearPhoto(
  input: unknown,
): Promise<Result<null>> {
  const storage = await getPropertyPhotoStorage()
  const store = createJsonPropertyStore()
  const result = await runClearPhoto({ storage, store }, input)

  if (result.ok) {
    const reference = extractPropertyReference(input)
    if (reference) {
      updateTag(`property:${reference}`)
    }
  }

  return result
}
