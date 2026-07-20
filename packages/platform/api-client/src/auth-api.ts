/**
 * Server-to-server calls against the auth service. Token-minting calls return
 * the parsed JSON body — which now carries the refresh token (auth-sdk
 * TokenBundle style); the BFF owns the cookies (see cookies.ts).
 */
import type { AdminUserSession } from '@iedora/contracts'

import { AUTH_URL } from './config'
import type { TokenResponse } from './cookies'
import { ApiError, errorMessageFromResponse } from './error'

export type AuthResult = {
  tokens: TokenResponse
}

async function tokenCall(path: string, init: RequestInit): Promise<AuthResult> {
  const res = await fetch(`${AUTH_URL}${path}`, { ...init, cache: 'no-store' })
  if (!res.ok) {
    throw new ApiError(res.status, await errorMessageFromResponse(res))
  }
  return { tokens: (await res.json()) as TokenResponse }
}

/** fetch against the auth service that throws ApiError on non-2xx and decodes
 *  the JSON body (undefined for 204). The single home for the `no-store` +
 *  error-handling boilerplate every non-token auth endpoint shares. */
async function authCall<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${AUTH_URL}${path}`, { ...init, cache: 'no-store' })
  if (!res.ok) throw new ApiError(res.status, await errorMessageFromResponse(res))
  return (res.status === 204 ? undefined : await res.json()) as T
}

export function login(email: string, password: string): Promise<AuthResult> {
  return tokenCall('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export function register(email: string, password: string, name: string): Promise<AuthResult> {
  return tokenCall('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })
}

/**
 * Rotates the refresh token. Returns null when the token is dead
 * (expired / revoked / reused) — callers clear cookies and re-auth.
 */
export async function refreshTokens(refreshToken: string): Promise<AuthResult | null> {
  try {
    return await tokenCall('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null
    throw err
  }
}

/** Revokes the session family; idempotent server-side. */
export async function logout(refreshToken: string): Promise<void> {
  await fetch(`${AUTH_URL}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  })
}

/**
 * Requests a password-reset email. The auth service always answers 200
 * (no account enumeration), so this resolves regardless of whether the
 * address exists — surface a neutral "check your inbox" either way.
 */
export async function forgotPassword(email: string): Promise<void> {
  await fetch(`${AUTH_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    cache: 'no-store',
  })
}

/**
 * Sets a new password from the opaque token in the emailed link. No
 * auto-login (the user signs in afterwards). Throws ApiError on a bad or
 * expired token (the auth service returns 400).
 */
export function resetPassword(token: string, password: string): Promise<void> {
  return authCall('/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  })
}

/**
 * Provisions a tenant owned by the authenticated user. The caller must
 * refresh afterwards so the access token picks up the new tenant id.
 */
export function createTenant(accessToken: string, name: string): Promise<{ tenantId: string }> {
  return authCall('/auth/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ name }),
  })
}

// --- authenticated self-service (Bearer access token) ---

/** The signed-in user's identity incl. the LIVE force-change flag (DB-read). */
export async function whoami(accessToken: string): Promise<{ mustChangePassword: boolean }> {
  const body = await authCall<{ mustChangePassword?: boolean }>('/auth/whoami', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return { mustChangePassword: body.mustChangePassword ?? false }
}

/** Change the signed-in user's password. `currentPassword` is required for a
 *  voluntary change but omitted for a forced one (just authenticated). Throws
 *  ApiError on 403 (wrong current) / 422 (missing current). */
export function changePassword(
  accessToken: string,
  input: { currentPassword?: string; newPassword: string },
): Promise<void> {
  return authCall('/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
  })
}

/** The signed-in user's own devices (sessions). */
export async function mySessions(accessToken: string): Promise<AdminUserSession[]> {
  const body = await authCall<{ sessions: AdminUserSession[] }>('/auth/sessions', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return body.sessions
}

/** Sign out one of my devices (session family), or all the others (`'*'`). */
export function revokeMyDevice(accessToken: string, family: string): Promise<void> {
  const path =
    family === '*' ? '/auth/sessions/revoke-others' : `/auth/sessions/${encodeURIComponent(family)}/revoke`
  return authCall(path, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } })
}
