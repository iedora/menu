import { describe, expect, it, vi } from 'vitest'
import { makeSessionAdapter, makeOidcFlowAdapter, isSameOriginPath } from './adapters/session'

vi.mock('server-only', () => ({}))

const SECRET = 'a'.repeat(48)

describe('session adapter — encrypted cookie round-trip', () => {
  it('seals + opens a session payload', async () => {
    const a = makeSessionAdapter(SECRET)
    const session = {
      user: { id: 'u1', email: 'u1@example.test', name: 'User One' },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    }
    const jwe = await a.seal(session)
    expect(jwe).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    const opened = await a.open(jwe)
    expect(opened?.user).toEqual(session.user)
    expect(opened?.expiresAt).toBe(session.expiresAt)
  })

  it('rejects a cookie sealed with a different secret (key rotation invalidates sessions)', async () => {
    const oldAdapter = makeSessionAdapter(SECRET)
    const newAdapter = makeSessionAdapter('b'.repeat(48))
    const jwe = await oldAdapter.seal({
      user: { id: 'u1', email: 'u1@example.test', name: 'U' },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    })
    expect(await newAdapter.open(jwe)).toBeNull()
  })

  it('returns null on tampered ciphertext (AES-GCM detects the bit-flip)', async () => {
    const a = makeSessionAdapter(SECRET)
    const jwe = await a.seal({
      user: { id: 'u1', email: 'u@x', name: 'U' },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    })
    // Flip a byte in the ciphertext (4th segment of compact JWE: hdr.cek.iv.ct.tag)
    const parts = jwe.split('.')
    if (!parts[3]) throw new Error('unexpected JWE shape')
    // Changing the first character of the base64url string guarantees modifying the first byte
    parts[3] = parts[3].startsWith('A') ? 'B' + parts[3].slice(1) : 'A' + parts[3].slice(1)
    expect(await a.open(parts.join('.'))).toBeNull()
  })

  it('returns null on expired payloads (exp in the past)', async () => {
    const a = makeSessionAdapter(SECRET)
    const past = Math.floor(Date.now() / 1000) - 60
    const jwe = await a.seal({
      user: { id: 'u1', email: 'u@x', name: 'U' },
      expiresAt: past,
    })
    expect(await a.open(jwe)).toBeNull()
  })

})

describe('OIDC flow cookie', () => {
  it('round-trips the {state, codeVerifier, next} envelope', async () => {
    const flow = makeOidcFlowAdapter(SECRET)
    const payload = { state: 'st1', codeVerifier: 'cv1', next: '/dashboard' }
    const jwe = await flow.seal(payload)
    expect(await flow.open(jwe)).toEqual(payload)
  })

  it('rejects payloads whose `next` field is an off-origin URL', async () => {
    const flow = makeOidcFlowAdapter(SECRET)
    // Bypass `seal`'s implicit validation by hand-crafting the path.
    // The open path re-validates same-origin, so the cookie reads null.
    const jwe = await flow.seal({
      state: 'st',
      codeVerifier: 'cv',
      next: 'https://evil.example/steal',
    })
    expect(await flow.open(jwe)).toBeNull()
  })
})

describe('isSameOriginPath', () => {
  it.each([
    ['/dashboard', true],
    ['/dashboard/r/sushi', true],
    ['', false],
    ['//evil', false],
    ['/\\evil', false],
    ['https://evil.example/steal', false],
    ['javascript:alert(1)', false],
    ['../escape', false],
  ])('matches %s → %s', (input, expected) => {
    expect(isSameOriginPath(input)).toBe(expected)
  })
})
