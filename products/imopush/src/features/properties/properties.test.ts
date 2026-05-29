import { describe, it, expect, vi } from 'vitest'
import { listProperties } from './use-cases/list-properties'
import { getProperty } from './use-cases/get-property'
import type { PropertiesGateway, Property } from './ports'

const TENANT_A = 'tenant-a'
const TENANT_B = 'tenant-b'

const sample: Property = {
  reference: 'ref-1',
  type: 'apartment',
  operation: 'sale',
  priceCents: 25_000_000,
  address: { locality: 'Lisboa' },
  contact: { name: 'Eduardo', email: 'me@example.com' },
}

function makeGateway(overrides: Partial<PropertiesGateway> = {}): PropertiesGateway {
  return {
    list: vi.fn(async (tenantId: string) => (tenantId === TENANT_A ? [sample] : [])),
    getByReference: vi.fn(async (tenantId: string, ref: string) =>
      tenantId === TENANT_A && ref === sample.reference ? sample : null,
    ),
    ...overrides,
  }
}

describe('listProperties', () => {
  it('delegates to the gateway with the tenantId', async () => {
    const gw = makeGateway()
    const rows = await listProperties(gw, TENANT_A)
    expect(rows).toEqual([sample])
    expect(gw.list).toHaveBeenCalledWith(TENANT_A)
  })

  it('does not leak rows across tenants', async () => {
    const gw = makeGateway()
    const rows = await listProperties(gw, TENANT_B)
    expect(rows).toEqual([])
  })
})

describe('getProperty', () => {
  it('returns null for empty reference without hitting the gateway', async () => {
    const gw = makeGateway()
    const got = await getProperty(gw, TENANT_A, '')
    expect(got).toBeNull()
    expect(gw.getByReference).not.toHaveBeenCalled()
  })

  it('returns the row when the gateway finds it under the tenant', async () => {
    const gw = makeGateway()
    const got = await getProperty(gw, TENANT_A, 'ref-1')
    expect(got?.reference).toBe('ref-1')
  })

  it('returns null when the gateway misses', async () => {
    const gw = makeGateway()
    const got = await getProperty(gw, TENANT_A, 'nope')
    expect(got).toBeNull()
  })

  it('does not leak across tenants', async () => {
    const gw = makeGateway()
    const got = await getProperty(gw, TENANT_B, 'ref-1')
    expect(got).toBeNull()
  })
})
