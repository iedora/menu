import { describe, it, expect, beforeEach, vi } from 'vitest'

// Vitest needs a fresh module each test so the factory's module-level
// `instance` cache doesn't bleed between cases.
async function loadFactory() {
  vi.resetModules()
  return await import('./factory')
}

describe('getStorageInstance — env wiring', () => {
  const baseEnv = {
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'iedora',
    S3_ACCESS_KEY: 'minio',
    S3_SECRET_KEY: 'minio12345',
  }

  beforeEach(() => {
    for (const k of Object.keys(baseEnv)) delete process.env[k]
    delete process.env.S3_PUBLIC_URL
  })

  it('throws a useful message when env vars are missing', async () => {
    const { getStorageInstance } = await loadFactory()
    expect(() => getStorageInstance()).toThrow(/Missing required env var: S3_ENDPOINT/)
  })

  it('returns a configured instance + bucket name', async () => {
    Object.assign(process.env, baseEnv)
    const { getStorageInstance } = await loadFactory()
    const { storage, bucket } = getStorageInstance()
    expect(storage).toBeDefined()
    expect(bucket).toBe('iedora')
  })

  it('caches as a singleton across calls', async () => {
    Object.assign(process.env, baseEnv)
    const { getStorageInstance } = await loadFactory()
    const a = getStorageInstance()
    const b = getStorageInstance()
    expect(a.storage).toBe(b.storage)
  })

  it('derives publicBaseUrl from endpoint + bucket when S3_PUBLIC_URL is unset', async () => {
    Object.assign(process.env, baseEnv)
    const { getStorageInstance } = await loadFactory()
    const { storage } = getStorageInstance()
    // Inferred via the keyFromPublicUrl behavior — the derived URL matches.
    expect(
      storage.keyFromPublicUrl('http://localhost:9000/iedora/path/x.jpg'),
    ).toBe('path/x.jpg')
  })

  it('honours S3_PUBLIC_URL for CDN-style serving', async () => {
    Object.assign(process.env, baseEnv, {
      S3_PUBLIC_URL: 'https://assets.iedora.com',
    })
    const { getStorageInstance } = await loadFactory()
    const { storage } = getStorageInstance()
    expect(
      storage.keyFromPublicUrl('https://assets.iedora.com/r/123/banner.jpg'),
    ).toBe('r/123/banner.jpg')
    expect(
      storage.keyFromPublicUrl('http://localhost:9000/iedora/r/123/banner.jpg'),
    ).toBeNull()
  })
})
