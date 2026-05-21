// Test env BEFORE importing the adapter (env.ts parses on import).
process.env.DATABASE_URL ||= 'postgres://test:test@localhost/test'
process.env.MENU_PUBLIC_URL ||= 'http://localhost:3000'
process.env.MENU_SESSION_SECRET ||= 'a'.repeat(48)
process.env.ZITADEL_ISSUER_URL ||= 'https://auth.test.local'
process.env.ZITADEL_OAUTH_CLIENT_ID ||= 'menu-test'
process.env.ZITADEL_OAUTH_CLIENT_SECRET ||= 'test-secret'
process.env.ZITADEL_MANAGEMENT_TOKEN ||= 'test-pat'
process.env.ZITADEL_ACTION_SIGNING_KEY ||= 'test-signing-key'
process.env.S3_ENDPOINT ||= 'http://localhost:4566'
process.env.S3_REGION ||= 'us-east-1'
process.env.S3_ACCESS_KEY ||= 'test'
process.env.S3_SECRET_KEY ||= 'test'
process.env.S3_BUCKET ||= 'test'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { zitadelHttpIdentity } = await import('./zitadel-http')

type FetchCall = { url: string; init: RequestInit }

const calls: FetchCall[] = []
let nextResponses: Response[] = []

beforeEach(() => {
  calls.length = 0
  nextResponses = []
  globalThis.fetch = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: url.toString(), init })
    const r = nextResponses.shift()
    if (!r) throw new Error(`unexpected fetch to ${url}`)
    return r
  }) as typeof fetch
})

afterEach(() => {
  vi.restoreAllMocks()
})

function jsonRes(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

/** base64 of the utf-8 bytes — matches what Zitadel returns for metadata values. */
function b64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64')
}

describe('zitadelHttpIdentity.listOrganizations', () => {
  it('reads the user-metadata primary org, then fetches that one org', async () => {
    nextResponses.push(
      jsonRes({
        metadata: [{ key: 'primaryOrgId', value: b64('org-1') }],
      }),
    )
    nextResponses.push(
      jsonRes({
        details: { totalResult: '1' },
        result: [{ id: 'org-1', name: 'House Tavern' }],
      }),
    )

    const orgs = await zitadelHttpIdentity.listOrganizations('u-7')

    expect(orgs).toEqual([
      { id: 'org-1', name: 'House Tavern', slug: 'house-tavern' },
    ])
    expect(calls).toHaveLength(2)

    const meta = calls[0]!
    expect(meta.url).toBe(
      'https://auth.test.local/zitadel.user.v2.UserService/ListUserMetadata',
    )
    expect(meta.init.method).toBe('POST')
    expect(JSON.parse(meta.init.body as string)).toEqual({ userId: 'u-7' })
    expect(new Headers(meta.init.headers).get('authorization')).toBe(
      'Bearer test-pat',
    )

    const search = calls[1]!
    expect(search.url).toBe('https://auth.test.local/v2/organizations/_search')
    expect(JSON.parse(search.init.body as string)).toEqual({
      queries: [{ idQuery: { id: 'org-1' } }],
    })
  })

  it('returns an empty list when the user has no primary-org metadata', async () => {
    nextResponses.push(jsonRes({ metadata: [] }))
    expect(await zitadelHttpIdentity.listOrganizations('u-7')).toEqual([])
    expect(calls).toHaveLength(1) // never reaches the org search
  })

  it('returns an empty list when the metadata call returns a non-2xx', async () => {
    nextResponses.push(new Response('nope', { status: 500 }))
    expect(await zitadelHttpIdentity.listOrganizations('u-7')).toEqual([])
  })

  it('returns an empty list when fetch throws (network/DNS)', async () => {
    globalThis.fetch = (async () => {
      throw new Error('boom')
    }) as typeof fetch
    expect(await zitadelHttpIdentity.listOrganizations('u-7')).toEqual([])
  })

  it('returns an empty list when the referenced org is missing (deleted upstream)', async () => {
    nextResponses.push(
      jsonRes({
        metadata: [{ key: 'primaryOrgId', value: b64('org-ghost') }],
      }),
    )
    nextResponses.push(jsonRes({ details: { totalResult: '0' }, result: [] }))
    expect(await zitadelHttpIdentity.listOrganizations('u-7')).toEqual([])
  })
})

describe('zitadelHttpIdentity.createOrganization', () => {
  it('creates the org via v2 with admins[] and stashes primaryOrgId metadata', async () => {
    nextResponses.push(jsonRes({ organizationId: 'org-new' }))
    nextResponses.push(jsonRes({ setDate: '2026-05-21T00:00:00Z' }))

    const result = await zitadelHttpIdentity.createOrganization(
      'u-7',
      'Café Apex',
      'cafe-apex',
    )

    expect(result).toEqual({ id: 'org-new', name: 'Café Apex', slug: 'cafe-apex' })
    expect(calls).toHaveLength(2)

    const create = calls[0]!
    expect(create.url).toBe('https://auth.test.local/v2/organizations')
    expect(create.init.method).toBe('POST')
    expect(JSON.parse(create.init.body as string)).toEqual({
      name: 'Café Apex',
      admins: [{ userId: 'u-7', roles: ['ORG_OWNER'] }],
    })

    const meta = calls[1]!
    expect(meta.url).toBe(
      'https://auth.test.local/zitadel.user.v2.UserService/SetUserMetadata',
    )
    expect(meta.init.method).toBe('POST')
    expect(JSON.parse(meta.init.body as string)).toEqual({
      userId: 'u-7',
      metadata: [{ key: 'primaryOrgId', value: b64('org-new') }],
    })
  })

  it('returns null when org creation itself fails', async () => {
    nextResponses.push(new Response('{}', { status: 409 }))
    expect(await zitadelHttpIdentity.createOrganization('u-7', 'X', 'x')).toBeNull()
    expect(calls).toHaveLength(1) // never reaches metadata
  })

  it('still returns the org when the metadata write fails (recoverable on next sign-in)', async () => {
    nextResponses.push(jsonRes({ organizationId: 'org-new' }))
    nextResponses.push(new Response('{}', { status: 500 }))

    const result = await zitadelHttpIdentity.createOrganization('u-7', 'X', 'x')
    expect(result).toEqual({ id: 'org-new', name: 'X', slug: 'x' })
  })
})

describe('zitadelHttpIdentity.setActiveOrganization', () => {
  it('writes primaryOrgId metadata to Zitadel via v2 UserService', async () => {
    nextResponses.push(jsonRes({ setDate: '2026-05-21T00:00:00Z' }))

    expect(
      await zitadelHttpIdentity.setActiveOrganization('u-7', 'org-1'),
    ).toBe(true)

    expect(calls).toHaveLength(1)
    const call = calls[0]!
    expect(call.url).toBe(
      'https://auth.test.local/zitadel.user.v2.UserService/SetUserMetadata',
    )
    expect(JSON.parse(call.init.body as string)).toEqual({
      userId: 'u-7',
      metadata: [{ key: 'primaryOrgId', value: b64('org-1') }],
    })
  })

  it('returns false when the metadata write fails', async () => {
    nextResponses.push(new Response('{}', { status: 500 }))
    expect(
      await zitadelHttpIdentity.setActiveOrganization('u-7', 'org-1'),
    ).toBe(false)
  })
})
