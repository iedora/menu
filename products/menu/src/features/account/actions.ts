'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { AdminUserSession } from '@iedora/contracts'
import {
  ACCESS_COOKIE,
  ApiError,
  changePassword,
  getSession,
  mySessions,
  revokeMyDevice,
} from '@iedora/api-client'
import { signInUrl } from '../../shared/auth-urls'
import { publicUrl } from '../../shared/url'

/**
 * Self-service account-security actions — the signed-in owner managing THEIR
 * OWN account (change password, see/kick their devices). All run as Server
 * Actions so the fresh access token (self-healed by `getSession`) is available
 * to authorize the call against the auth service.
 */

/** A fresh Bearer access token for the current user, or bounce to sign-in.
 *  `getSession` self-heals an expired token in a Server Action (writes allowed),
 *  so the access cookie is valid right after it resolves. */
async function accessToken(): Promise<string> {
  const session = await getSession()
  const token = session ? (await cookies()).get(ACCESS_COOKIE)?.value : undefined
  if (!token) redirect(signInUrl(publicUrl('/menu/dashboard').toString()))
  return token
}

export type ChangePwResult =
  | { ok: true }
  | { ok: false; error: 'wrongCurrent' | 'currentRequired' | 'failed' }

/** Change the current user's password. Omit `currentPassword` for the forced
 *  flow (just authenticated); include it for a voluntary change in settings. */
export async function changePasswordAction(input: {
  currentPassword?: string
  newPassword: string
}): Promise<ChangePwResult> {
  const token = await accessToken()
  try {
    await changePassword(token, input)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 403) return { ok: false, error: 'wrongCurrent' }
      if (err.status === 422) return { ok: false, error: 'currentRequired' }
    }
    return { ok: false, error: 'failed' }
  }
}

/** The current user's own devices (sessions), newest first. */
export async function listMyDevicesAction(): Promise<AdminUserSession[]> {
  return mySessions(await accessToken())
}

/** Sign out one of my devices (a session family), or `'*'` for all the others. */
export async function revokeMyDeviceAction(family: string): Promise<{ ok: boolean }> {
  // Resolve the token OUTSIDE the try: accessToken() may redirect() on an
  // expired session, and redirect throws a control-flow signal the bare catch
  // would otherwise swallow (leaving the user stranded with a silent {ok:false}).
  const token = await accessToken()
  try {
    await revokeMyDevice(token, family)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
