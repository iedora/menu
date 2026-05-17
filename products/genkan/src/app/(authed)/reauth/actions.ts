'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { verifyPassword } from 'better-auth/crypto'
import { auth } from '@/features/auth/adapters/better-auth-instance'
import { db } from '@/shared/db/client'
import { account, session as sessionTable } from '@/shared/db/schema'
import { resolveSafeReturnTo } from '../../(auth)/_lib/safe-return-to'

type Result = { ok: true } | { ok: false; error: string }

/**
 * Verify the caller's password against their `credential` account row,
 * then mark the current session as freshly-authenticated by bumping
 * `session.lastPasswordAt` to `now()`. On success, redirects to
 * `return_to`. On failure, returns a structured error for the client
 * form to render.
 *
 * Crucially, we DON'T call `auth.api.signInEmail` here — that would mint
 * a new session row alongside the existing one. We refresh the in-flight
 * session in place so the original session-token cookie keeps working.
 */
export async function confirmPasswordAction(
  formData: FormData,
): Promise<Result> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { ok: false, error: 'Not signed in.' }
  }

  const password = String(formData.get('password') ?? '')
  if (!password) {
    return { ok: false, error: 'Password is required.' }
  }

  // Look up the credential account row for the caller. Email-password
  // accounts always live under providerId='credential'.
  const [credentialAccount] = await db
    .select({
      password: account.password,
    })
    .from(account)
    .where(
      and(
        eq(account.userId, session.user.id),
        eq(account.providerId, 'credential'),
      ),
    )
    .limit(1)

  if (!credentialAccount?.password) {
    return {
      ok: false,
      error: 'This account has no password set. Sign in with the original provider.',
    }
  }

  const ok = await verifyPassword({
    hash: credentialAccount.password,
    password,
  })
  if (!ok) {
    return { ok: false, error: 'Incorrect password.' }
  }

  // Re-stamp this session row in place.
  await db
    .update(sessionTable)
    .set({ lastPasswordAt: new Date() })
    .where(eq(sessionTable.id, session.session.id))

  // Same allow-list as /login — never trust the raw return_to.
  const returnTo = resolveSafeReturnTo(String(formData.get('return_to') ?? ''))
  redirect(returnTo)
}
