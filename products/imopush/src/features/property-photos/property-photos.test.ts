import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StorageError, type Storage } from '@iedora/storage'
import { presignPhoto } from './use-cases/presign-photo'
import { commitPhoto } from './use-cases/commit-photo'
import { clearPhoto } from './use-cases/clear-photo'
import type { PropertyStore } from './ports'

function makeFakeStorage(overrides: Partial<Storage> = {}): Storage {
  return {
    presignPut: vi.fn(async (key) => ({
      key,
      uploadUrl: `https://minio.local/${key}?signed=1`,
      publicUrl: `https://cdn.local/${key}`,
      expiresInSeconds: 300,
    })),
    head: vi.fn(async () => ({ contentLength: 100, contentType: 'image/jpeg' })),
    delete: vi.fn(async () => {}),
    keyFromPublicUrl: vi.fn((url: string) => {
      const m = url.match(/cdn\.local\/(.+)$/)
      return m ? m[1] : null
    }),
    ...overrides,
  }
}

function makeFakeStore(initialUrls: string[] = []): {
  store: PropertyStore
  added: string[]
  removed: string[]
} {
  const urls = [...initialUrls]
  const added: string[] = []
  const removed: string[] = []
  const store: PropertyStore = {
    getPhotoUrls: vi.fn(async () => [...urls]),
    addPhotoUrl: vi.fn(async (_ref, url) => {
      urls.push(url)
      added.push(url)
    }),
    removePhotoUrl: vi.fn(async (_ref, url) => {
      const idx = urls.indexOf(url)
      if (idx >= 0) urls.splice(idx, 1)
      removed.push(url)
    }),
  }
  return { store, added, removed }
}

describe('presignPhoto', () => {
  const validInput = {
    target: { kind: 'property-photo' as const, propertyReference: 'ref-1' },
    contentType: 'image/jpeg',
    contentLengthBytes: 1024 * 100,
  }

  it('rejects unsupported MIME types', async () => {
    const storage = makeFakeStorage()
    const result = await presignPhoto({ storage }, {
      ...validInput,
      contentType: 'application/pdf',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/unsupported/i)
    expect(storage.presignPut).not.toHaveBeenCalled()
  })

  it('rejects files larger than 10 MB', async () => {
    const storage = makeFakeStorage()
    const result = await presignPhoto({ storage }, {
      ...validInput,
      contentLengthBytes: 11 * 1024 * 1024,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/too large/i)
  })

  it('builds a tenant-prefixed key and forwards to storage', async () => {
    const storage = makeFakeStorage()
    const result = await presignPhoto({ storage }, validInput)
    expect(result.ok).toBe(true)
    expect(storage.presignPut).toHaveBeenCalledOnce()
    const [key, opts] = vi.mocked(storage.presignPut).mock.calls[0]
    expect(key).toMatch(/^p\/ref-1\/photos\/.+\.jpg$/)
    expect(opts).toMatchObject({
      contentType: 'image/jpeg',
      contentLengthBytes: validInput.contentLengthBytes,
    })
  })

  it('wraps StorageError into a structured error', async () => {
    const storage = makeFakeStorage({
      presignPut: vi.fn(async () => {
        throw new StorageError('presign failed: AccessDenied')
      }),
    })
    const result = await presignPhoto({ storage }, validInput)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/AccessDenied/)
  })
})

describe('commitPhoto', () => {
  const validInput = {
    target: { kind: 'property-photo' as const, propertyReference: 'ref-1' },
    key: 'p/ref-1/photos/abc.jpg',
    publicUrl: 'https://cdn.local/p/ref-1/photos/abc.jpg',
  }

  it('rejects keys that do not belong to the target property', async () => {
    const storage = makeFakeStorage()
    const { store } = makeFakeStore()
    await expect(
      commitPhoto({ storage, store }, {
        ...validInput,
        key: 'p/different-property/photos/abc.jpg',
      }),
    ).rejects.toThrow(/does not belong/i)
    expect(store.addPhotoUrl).not.toHaveBeenCalled()
  })

  it('fails when storage.head returns null (upload incomplete)', async () => {
    const storage = makeFakeStorage({ head: vi.fn(async () => null) })
    const { store } = makeFakeStore()
    const result = await commitPhoto({ storage, store }, validInput)
    expect(result.ok).toBe(false)
    expect(store.addPhotoUrl).not.toHaveBeenCalled()
  })

  it('verifies via head then persists URL to store', async () => {
    const storage = makeFakeStorage()
    const { store, added } = makeFakeStore()
    const result = await commitPhoto({ storage, store }, validInput)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.url).toBe(validInput.publicUrl)
    expect(storage.head).toHaveBeenCalledWith(validInput.key)
    expect(added).toEqual([validInput.publicUrl])
  })
})

describe('clearPhoto', () => {
  const validInput = {
    target: { kind: 'property-photo' as const, propertyReference: 'ref-1' },
    publicUrl: 'https://cdn.local/p/ref-1/photos/abc.jpg',
  }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('removes URL from store and deletes the underlying object', async () => {
    const storage = makeFakeStorage()
    const { store, removed } = makeFakeStore([validInput.publicUrl])

    const result = await clearPhoto({ storage, store }, validInput)
    expect(result.ok).toBe(true)
    expect(removed).toEqual([validInput.publicUrl])
    expect(storage.delete).toHaveBeenCalledWith('p/ref-1/photos/abc.jpg')
  })

  it('swallows "not found" errors as expected', async () => {
    const storage = makeFakeStorage({
      delete: vi.fn(async () => {
        throw new StorageError('object not found')
      }),
    })
    const { store } = makeFakeStore([validInput.publicUrl])

    const result = await clearPhoto({ storage, store }, validInput)
    expect(result.ok).toBe(true)
    expect(store.removePhotoUrl).toHaveBeenCalled()
  })

  it('does not call storage.delete when keyFromPublicUrl returns null', async () => {
    const storage = makeFakeStorage({
      keyFromPublicUrl: vi.fn(() => null),
    })
    const { store } = makeFakeStore([validInput.publicUrl])

    const result = await clearPhoto({ storage, store }, validInput)
    expect(result.ok).toBe(true)
    expect(storage.delete).not.toHaveBeenCalled()
    expect(store.removePhotoUrl).toHaveBeenCalled()
  })
})
