/**
 * Storage port — every product in the iedora estate uses this interface
 * to talk to S3-compatible backends (R2, MinIO, LocalStack, AWS S3).
 *
 * The port is intentionally narrow: presign a PUT, verify an object exists,
 * delete an object, and map a public URL back to its key. Products layer
 * their own asset-target schema, auth gating, and DB persistence on top.
 */

export type PresignedUploadRequest = {
  contentType: string
  contentLengthBytes: number
}

export type PresignedUpload = {
  uploadUrl: string
  publicUrl: string
  key: string
  expiresInSeconds: number
}

export type StoredObject = {
  contentLength: number
  contentType: string | undefined
}

export interface Storage {
  presignPut(key: string, req: PresignedUploadRequest): Promise<PresignedUpload>
  /** Returns null if the object does not exist. */
  head(key: string): Promise<StoredObject | null>
  delete(key: string): Promise<void>
  /** Returns null when the URL did not originate from this storage. */
  keyFromPublicUrl(url: string): string | null
}

export class StorageError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'StorageError'
  }
}
