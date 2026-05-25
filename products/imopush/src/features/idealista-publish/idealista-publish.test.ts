import { describe, it, expect, vi } from 'vitest'
import { publishProperty } from './use-cases/publish-property'
import type {
  IdealistaPublisher,
  PropertyIntegratorStore,
  PublishResult,
} from './ports'
import type { Property, IntegratorStatus } from '@/shared/data/properties'

function makeFakeStore(initial?: Property) {
  const saved: IntegratorStatus[] = []
  const store: PropertyIntegratorStore = {
    getProperty: vi.fn(async () => initial ?? null),
    setIntegratorStatus: vi.fn(async (_ref, status) => {
      saved.push(status)
    }),
  }
  return { store, saved }
}

function makeFakePublisher(result: PublishResult): IdealistaPublisher {
  return { publish: vi.fn(async () => result) }
}

const baseProperty: Property = {
  reference: 'ref-1',
  type: 'apartment',
  operation: 'sale',
  priceCents: 25_000_000,
  address: { locality: 'Lisboa' },
  contact: { name: 'Eduardo', email: 'me@example.com' },
}

describe('publishProperty', () => {
  it('rejects empty reference', async () => {
    const { store } = makeFakeStore()
    const publisher = makeFakePublisher({ ok: true })

    const result = await publishProperty(
      { publisher, store },
      { reference: '' },
    )

    expect(result.ok).toBe(false)
    expect(store.getProperty).not.toHaveBeenCalled()
    expect(publisher.publish).not.toHaveBeenCalled()
  })

  it('returns error when property is missing', async () => {
    const { store } = makeFakeStore(undefined)
    const publisher = makeFakePublisher({ ok: true })

    const result = await publishProperty(
      { publisher, store },
      { reference: 'missing' },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/não encontrada/i)
    expect(publisher.publish).not.toHaveBeenCalled()
  })

  it('writes publishing → published transition on success', async () => {
    const { store, saved } = makeFakeStore(baseProperty)
    const publisher = makeFakePublisher({
      ok: true,
      publishedUrl: 'https://www.idealista.pt/imovel/12345/',
    })

    const result = await publishProperty(
      { publisher, store },
      { reference: 'ref-1' },
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.publishedUrl).toBe('https://www.idealista.pt/imovel/12345/')

    expect(saved).toHaveLength(2)
    expect(saved[0]).toMatchObject({ key: 'idealista', status: 'publishing' })
    expect(saved[1]).toMatchObject({
      key: 'idealista',
      status: 'published',
      publishedUrl: 'https://www.idealista.pt/imovel/12345/',
    })
    expect(saved[1].publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/) // ISO
  })

  it('writes publishing → failed transition on publisher error', async () => {
    const { store, saved } = makeFakeStore(baseProperty)
    const publisher = makeFakePublisher({ ok: false, error: 'CDP timeout' })

    const result = await publishProperty(
      { publisher, store },
      { reference: 'ref-1' },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('CDP timeout')

    expect(saved).toHaveLength(2)
    expect(saved[0]).toMatchObject({ status: 'publishing' })
    expect(saved[1]).toMatchObject({
      key: 'idealista',
      status: 'failed',
      lastError: 'CDP timeout',
    })
  })

  it('passes the property unchanged to the publisher', async () => {
    const { store } = makeFakeStore(baseProperty)
    const publisher = makeFakePublisher({ ok: true })

    await publishProperty({ publisher, store }, { reference: 'ref-1' })

    expect(publisher.publish).toHaveBeenCalledWith(baseProperty)
  })

  it('publishes successfully even without a returned URL', async () => {
    const { store, saved } = makeFakeStore(baseProperty)
    const publisher = makeFakePublisher({ ok: true })

    const result = await publishProperty(
      { publisher, store },
      { reference: 'ref-1' },
    )

    expect(result.ok).toBe(true)
    expect(saved[1]).toMatchObject({ status: 'published' })
    expect(saved[1].publishedUrl).toBeUndefined()
  })
})
