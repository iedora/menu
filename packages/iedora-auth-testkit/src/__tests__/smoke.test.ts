import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestGenkan, type TestGenkanHandle } from '../index'

describe('startTestGenkan', () => {
  let handle: TestGenkanHandle

  beforeAll(async () => {
    handle = await startTestGenkan()
  })

  afterAll(async () => {
    await handle.stop()
  })

  it('binds to a random free port and responds to /up', async () => {
    expect(handle.url).toMatch(/^http:\/\/localhost:\d+$/)
    const res = await fetch(`${handle.url}/up`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('exposes the OIDC discovery document with a matching issuer', async () => {
    const res = await fetch(handle.discoveryUrl)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      issuer: string
      jwks_uri: string
      authorization_endpoint: string
      token_endpoint: string
    }
    // Better Auth mounts every endpoint under basePath `/api/auth`, so the
    // OIDC issuer is `${baseURL}/api/auth` — consumers that use
    // `discoveryUrl` to bootstrap pick this up automatically.
    expect(body.issuer.startsWith(handle.url)).toBe(true)
    expect(body.jwks_uri).toContain(handle.url)
    expect(body.authorization_endpoint).toContain(handle.url)
    expect(body.token_endpoint).toContain(handle.url)
  })

  it('serves a real JWKS at the advertised jwks_uri', async () => {
    const disc = (await (await fetch(handle.discoveryUrl)).json()) as {
      jwks_uri: string
    }
    const res = await fetch(disc.jwks_uri)
    expect(res.status).toBe(200)
    const jwks = (await res.json()) as { keys: unknown[] }
    expect(Array.isArray(jwks.keys)).toBe(true)
    expect(jwks.keys.length).toBeGreaterThanOrEqual(1)
  })
})

describe('startTestGenkan — boot timing', () => {
  it('cold-starts in a sane time window (catches catastrophic regressions only)', async () => {
    const t0 = performance.now()
    const handle = await startTestGenkan()
    const elapsed = performance.now() - t0
    await handle.stop()
    // Local dev laptops boot in ~150-500ms; GitHub Actions ubuntu-24.04
    // runners are noisier and have hit ~1.9s on the slower spec. The
    // assertion exists to catch catastrophic regressions (10x slowdowns,
    // infinite loops on init) — not to police perf, which is hardware-
    // dependent. The number was 1500ms originally; bumped after CI flake.
    expect(elapsed).toBeLessThan(5000)
  })
})
