"use server"

import type { SubmissionResult } from "@conform-to/dom"
import { parseWithZod } from "@conform-to/zod/v4"
import { completeOAuth, forgotPassword, login, register, resetPassword } from "@iedora/auth-sdk/next"

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./schemas.ts"

// Central-auth server actions — thin Conform wrappers over the ONE shared auth
// integration (@iedora/auth-sdk/next), which owns the credential exchange with
// the iedora realm AND writes the shared .iedora.com SSO cookies. These actions
// only validate the form and translate failures into a Conform reply. On success
// the form does a full-page navigation to `next` so the fresh cookies are always
// present at the destination — never redirect from inside the action (it races
// the just-written cookies).

export async function signInAction(_prev: unknown, formData: FormData): Promise<SubmissionResult> {
  const submission = parseWithZod(formData, { schema: signInSchema })
  if (submission.status !== "success") return submission.reply()
  const result = await login(submission.value)
  // Wrong email/password (or any auth failure) — never leak which.
  if (result.error) return submission.reply({ formErrors: ["Invalid email or password."] })
  return submission.reply()
}

export async function signUpAction(_prev: unknown, formData: FormData): Promise<SubmissionResult> {
  const submission = parseWithZod(formData, { schema: signUpSchema })
  if (submission.status !== "success") return submission.reply()
  const result = await register(submission.value)
  if (result.error) return submission.reply({ formErrors: [result.error.message] })
  return submission.reply()
}

/** Kicks off a reset email. The auth service never reveals whether the address
 *  exists, so this ALWAYS reports success — the form shows a neutral screen. */
export async function forgotPasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<SubmissionResult> {
  const submission = parseWithZod(formData, { schema: forgotPasswordSchema })
  if (submission.status !== "success") return submission.reply()
  try {
    await forgotPassword(submission.value.email)
  } catch {
    // no enumeration, no error surface — still report success
  }
  return submission.reply()
}

/** Sets a new password from the emailed token. A bad/expired token is a form
 *  error; no auto-login (the success screen sends the user to sign in). */
export async function resetPasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<SubmissionResult> {
  const submission = parseWithZod(formData, { schema: resetPasswordSchema })
  if (submission.status !== "success") return submission.reply()
  const token = String(formData.get("token") ?? "")
  try {
    await resetPassword(token, submission.value.password)
  } catch {
    return submission.reply({ formErrors: ["This reset link is invalid or has expired."] })
  }
  return submission.reply()
}

/** Complete an OAuth sign-in: verify the tokens from the callback fragment and
 *  set the shared session cookies. */
export async function completeOAuthAction(
  accessToken: string,
  refreshToken: string,
): Promise<{ error?: { message: string } }> {
  return completeOAuth(accessToken, refreshToken)
}
