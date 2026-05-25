import { S3Storage } from './s3'

function readEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

let instance: S3Storage | null = null
let bucket: string | null = null

function getInstance(): { storage: S3Storage; bucket: string } {
  if (instance && bucket) return { storage: instance, bucket }
  const endpoint = readEnv('S3_ENDPOINT')
  const region = readEnv('S3_REGION')
  bucket = readEnv('S3_BUCKET')
  const accessKey = readEnv('S3_ACCESS_KEY')
  const secretKey = readEnv('S3_SECRET_KEY')
  // LocalStack (CI, dev when docker-compose is up) needs path-style addressing.
  // R2 + AWS S3 use virtual-host style — the SDK's default. Auto-detect via
  // endpoint URL so neither side has to be configured explicitly.
  const forcePathStyle = /localhost|127\.0\.0\.1|localstack/i.test(endpoint)
  // Public URL: with R2 + custom domain (S3_PUBLIC_URL set), serve direct
  // from the Cloudflare edge. With LocalStack, derive a path-style URL from
  // the endpoint + bucket.
  const publicBaseUrl =
    process.env.S3_PUBLIC_URL ?? `${endpoint.replace(/\/$/, '')}/${bucket}`

  instance = new S3Storage({
    endpoint,
    region,
    bucket,
    accessKey,
    secretKey,
    publicBaseUrl,
    forcePathStyle,
  })
  return { storage: instance, bucket }
}

/**
 * Returns the singleton S3Storage instance and its bucket name.
 *
 * Callers that need idempotent bucket creation should pair this with
 * `ensureBucket` from `./bootstrap`.
 */
export function getStorageInstance(): { storage: S3Storage; bucket: string } {
  return getInstance()
}

/**
 * Convenience wrapper: returns the storage port ready for use.
 * Products that need bootstrap should call `ensureBucket` themselves.
 */
export function getStorage(): S3Storage {
  return getInstance().storage
}
