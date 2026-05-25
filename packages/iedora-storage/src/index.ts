/**
 * @iedora/storage — S3-compatible storage port for every iedora product.
 *
 * Products layer their own asset-target schema, auth gating, and DB persistence
 * on top of this generic port. See menu's `features/upload/` for a complete
 * example of the vertical-slice pattern built on these primitives.
 *
 * Usage:
 *   import { getStorage, ensureBucket, StorageError } from '@iedora/storage'
 *   const { storage, bucket } = getStorageInstance()
 *   await ensureBucket(storage, bucket, { publicPrefix: 'r/', corsOrigins: { putHead: [publicUrl] } })
 *   const upload = await storage.presignPut(key, { contentType, contentLengthBytes })
 */

export type {
  Storage,
  PresignedUpload,
  PresignedUploadRequest,
  StoredObject,
} from './types'
export { StorageError } from './types'
export { S3Storage, type S3StorageConfig } from './s3'
export { getStorage, getStorageInstance } from './factory'
export { ensureBucket, type EnsureBucketOptions } from './bootstrap'
