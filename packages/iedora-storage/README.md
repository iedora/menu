# @iedora/storage

S3-compatible storage port shared by every iedora product. The interface is
deliberately narrow: presign a PUT, verify the object landed, delete it,
map a public URL back to its key. Products layer their own asset-target
schema, auth, and DB persistence on top.

## Public API

```ts
import {
  getStorage,           // S3Storage singleton (auto-configured from env)
  getStorageInstance,   // { storage, bucket } — for bootstrap callers
  ensureBucket,         // idempotent: create bucket + apply policy + CORS
  StorageError,         // wrapper thrown for all backend failures
  type Storage,         // the 4-method interface
  type PresignedUpload,
  type PresignedUploadRequest,
  type StoredObject,
} from '@iedora/storage'
```

### `Storage` interface

| method | purpose |
| --- | --- |
| `presignPut(key, req)` | Returns a 5-minute presigned PUT URL + the public URL. |
| `head(key)` | Returns `null` when missing, `StoredObject` when present. |
| `delete(key)` | Removes the object. Best-effort: missing key is not an error. |
| `keyFromPublicUrl(url)` | Reverse-maps a public URL back to its bucket key. |

## Configuration

All required at runtime — the factory throws if any are missing.

| env | example |
| --- | --- |
| `S3_ENDPOINT` | `https://<account>.r2.cloudflarestorage.com` (R2), `http://localhost:9000` (MinIO) |
| `S3_REGION` | `auto` (R2), `us-east-1` (AWS), `us-east-1` (MinIO/LocalStack) |
| `S3_BUCKET` | tenant bucket name |
| `S3_ACCESS_KEY` | access key id |
| `S3_SECRET_KEY` | secret access key |
| `S3_PUBLIC_URL` *(optional)* | CDN base. Defaults to `${endpoint}/${bucket}` — fine for local MinIO. |

**Path-style addressing** is auto-enabled when the endpoint matches
`localhost | 127.0.0.1 | localstack` — MinIO + LocalStack need it. R2 + AWS
use virtual-hosted style (the SDK default).

## When to call `ensureBucket`

Use it from the product's process-init hook (Next 16:
`src/instrumentation.ts`) when:

- the bucket may not exist (local dev with fresh docker compose),
- you need a tenant prefix to be publicly readable,
- you need CORS configured for the browser-side PUT/HEAD.

Skip it in production environments where the bucket is pre-provisioned
and the bucket policy / CORS are managed via Terraform.

```ts
import { getStorageInstance, ensureBucket } from '@iedora/storage'

const { storage, bucket } = getStorageInstance()
await ensureBucket(storage, bucket, {
  publicPrefix: 'r/',                        // serve r/* publicly
  corsOrigins: { get: ['*'], putHead: [publicUrl] },
})
```

## Testing

Unit tests live under `src/**/*.test.ts` (run with `bun run test`). They
exercise pure helpers — `keyFromPublicUrl`, error mapping, factory
env-var detection. They do NOT spin up a real S3 client; consumers
exercise the live roundtrip in their own e2e suites (see menu's
`src/features/upload/e2e/storage.spec.ts`).

## Why a single S3 adapter

Every backend we ship to today (R2, AWS S3, MinIO, LocalStack) speaks the
S3 protocol. When we add a non-S3 backend (Azure Blob, GCS) we'll split
the package so `getStorage()` returns the `Storage` interface and the
factory picks the impl — but that's a YAGNI until we have a real second
backend.
