import 'server-only'
import { getStorageInstance, ensureBucket, type Storage } from '@iedora/storage'
import { env } from '@/shared/env'

/**
 * Returns the storage port with menu-specific bootstrap.
 *
 * Asset hard rule #9: every uploaded object's S3 key starts with `r/{restaurantId}/`.
 * The bucket policy scopes public read to `r/*`, and CORS PUT/HEAD is gated to
 * the app's origin.
 */
export async function getStorage(): Promise<Storage> {
  const { storage, bucket } = getStorageInstance()
  await ensureBucket(storage, bucket, {
    publicPrefix: 'r/',
    corsOrigins: {
      get: ['*'],
      putHead: [env.MENU_PUBLIC_URL],
    },
  })
  return storage
}
