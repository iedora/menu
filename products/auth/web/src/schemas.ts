import { z } from "zod"

// Central-auth FORM schemas — shared by the Conform forms and their server
// actions so ONE schema validates on both sides. Messages are plain English
// (this surface is product-neutral and not wired to next-intl); each required
// string carries a type-level `error` so an empty field never leaks Zod's raw
// "expected string, received undefined" default to the UI.

/** Product password policy for new accounts. */
export const PASSWORD_MIN = 12

export const signInSchema = z.object({
  email: z.string({ error: "Enter your email" }).min(1, "Enter your email").email("Enter a valid email"),
  password: z.string({ error: "Enter your password" }).min(1, "Enter your password"),
})
export type SignInInput = z.infer<typeof signInSchema>

export const signUpSchema = z.object({
  name: z.string({ error: "Enter your name" }).trim().min(1, "Enter your name"),
  email: z.string({ error: "Enter your email" }).min(1, "Enter your email").email("Enter a valid email"),
  password: z
    .string({ error: "Choose a password" })
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`),
})
export type SignUpInput = z.infer<typeof signUpSchema>

export const forgotPasswordSchema = z.object({
  email: z.string({ error: "Enter your email" }).min(1, "Enter your email").email("Enter a valid email"),
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: z
      .string({ error: "Choose a password" })
      .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`),
    confirm: z.string({ error: "Re-enter your password" }),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] })
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
