import { describe, it, expect } from 'vitest'
import { S3Storage } from './s3'
import { StorageError } from './types'

const baseConfig = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  bucket: 'iedora',
  accessKey: 'minio',
  secretKey: 'minio12345',
  publicBaseUrl: 'http://localhost:9000/iedora',
  forcePathStyle: true,
}

describe('S3Storage.keyFromPublicUrl', () => {
  const storage = new S3Storage(baseConfig)

  it('strips the public base + bucket prefix', () => {
    const key = storage.keyFromPublicUrl(
      'http://localhost:9000/iedora/p/ref-1/photos/abc.jpg',
    )
    expect(key).toBe('p/ref-1/photos/abc.jpg')
  })

  it('returns null for URLs from a different bucket', () => {
    expect(
      storage.keyFromPublicUrl('https://cdn.other.com/p/ref-1/photos/abc.jpg'),
    ).toBeNull()
  })

  it('returns null for URLs that share only a prefix substring', () => {
    expect(
      storage.keyFromPublicUrl('http://localhost:9000/iedora-other/p/abc.jpg'),
    ).toBeNull()
  })

  it('handles publicBaseUrl with trailing slash', () => {
    const trailing = new S3Storage({
      ...baseConfig,
      publicBaseUrl: 'http://localhost:9000/iedora/',
    })
    const key = trailing.keyFromPublicUrl(
      'http://localhost:9000/iedora/p/ref-1/photos/abc.jpg',
    )
    expect(key).toBe('p/ref-1/photos/abc.jpg')
  })

  it('handles CDN-style publicBaseUrl on a custom domain', () => {
    const cdn = new S3Storage({
      ...baseConfig,
      publicBaseUrl: 'https://assets.iedora.com',
    })
    expect(
      cdn.keyFromPublicUrl('https://assets.iedora.com/r/123/menus/m1/banner.jpg'),
    ).toBe('r/123/menus/m1/banner.jpg')
  })
})

describe('StorageError', () => {
  it('preserves the underlying cause', () => {
    const cause = new Error('AccessDenied')
    const err = new StorageError('Failed to head object', cause)
    expect(err.name).toBe('StorageError')
    expect(err.message).toBe('Failed to head object')
    expect(err.cause).toBe(cause)
  })

  it('is identifiable via instanceof', () => {
    const err: unknown = new StorageError('x')
    expect(err instanceof StorageError).toBe(true)
    expect(err instanceof Error).toBe(true)
  })
})
