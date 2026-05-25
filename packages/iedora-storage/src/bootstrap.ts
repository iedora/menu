import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3'
import type { S3Storage } from './s3'

let bootstrapped = false

function publicReadPolicy(bucket: string, publicPrefix: string): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/${publicPrefix}*`],
      },
    ],
  })
}

export type EnsureBucketOptions = {
  /**
   * The key prefix that should be world-readable.
   * Defaults to `""` (whole bucket). Menu uses `r/`; imopush could use `p/`.
   */
  publicPrefix?: string
  /**
   * CORS origins. Defaults to `['*']` for GET and `[]` for PUT/HEAD.
   * Products should pass their public URL for PUT/HEAD so presigned uploads
   * work only from the app's origin.
   */
  corsOrigins?: {
    get?: string[]
    putHead?: string[]
  }
}

/**
 * Idempotent bucket bootstrap: create if missing, apply public-read policy
 * for the given prefix, and set CORS rules.
 *
 * Safe to call from multiple actions concurrently — only the first caller
 * pays the network cost; the rest see `bootstrapped === true` and skip.
 *
 * Skip entirely for Cloudflare R2: bucket + CORS + public-access custom
 * domain are all declaratively managed by infra/tofu/. PutBucketPolicy is
 * also unsupported on R2 (public access is via the custom-domain binding,
 * not a bucket policy), so trying to apply this would error.
 */
export async function ensureBucket(
  storage: S3Storage,
  bucket: string,
  options?: EnsureBucketOptions,
): Promise<void> {
  if (bootstrapped) return
  if (isR2Endpoint(storage)) {
    bootstrapped = true
    return
  }
  const client = storage.rawClient()

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch (err) {
    if (!isNotFound(err)) throw err
    await client.send(new CreateBucketCommand({ Bucket: bucket }))
  }

  // Re-applying the policy is cheap and self-heals if it was wiped manually.
  const prefix = options?.publicPrefix ?? ''
  await client.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: publicReadPolicy(bucket, prefix),
    }),
  )

  // CORS: GET stays open to any origin so public pages can render <img src>
  // without a preflight gate. PUT/HEAD only allow the app's origin.
  const getOrigins = options?.corsOrigins?.get ?? ['*']
  const putHeadOrigins = options?.corsOrigins?.putHead ?? []
  const rules = []
  if (getOrigins.length > 0) {
    rules.push({
      AllowedOrigins: getOrigins,
      AllowedMethods: ['GET'],
      AllowedHeaders: ['*'],
      MaxAgeSeconds: 3000,
    })
  }
  if (putHeadOrigins.length > 0) {
    rules.push({
      AllowedOrigins: putHeadOrigins,
      AllowedMethods: ['PUT', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3000,
    })
  }

  if (rules.length > 0) {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: { CORSRules: rules },
      }),
    )
  }

  bootstrapped = true
}

function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? err.name : undefined
  const status =
    '$metadata' in err && err.$metadata && typeof err.$metadata === 'object'
      ? (err.$metadata as { httpStatusCode?: number }).httpStatusCode
      : undefined
  return name === 'NotFound' || name === 'NoSuchBucket' || status === 404
}

function isR2Endpoint(storage: S3Storage): boolean {
  // We can't read the config back from the SDK client cleanly across versions,
  // so peek at the env var the factory passed through. Cheap + matches the
  // detection in factory.ts.
  return /r2\.cloudflarestorage\.com/.test(process.env.S3_ENDPOINT ?? '')
}
