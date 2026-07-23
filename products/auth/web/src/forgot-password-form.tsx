"use client"

import { getFormProps, getInputProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4"
import { Button } from "@iedora/ui/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@iedora/ui/components/ui/card"
import { TextField } from "@iedora/ui/components/field"
import Link from "next/link"
import { useActionState, useState } from "react"

import { forgotPasswordAction } from "./actions.ts"
import { forgotPasswordSchema } from "./schemas.ts"

export function ForgotPasswordForm({ signInHref }: { signInHref: string }) {
  const [lastResult, action, pending] = useActionState(forgotPasswordAction, undefined)
  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(forgotPasswordSchema),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    onValidate: ({ formData }) => parseWithZod(formData, { schema: forgotPasswordSchema }),
  })
  const [email, setEmail] = useState("")
  const { key: emailKey, ...emailProps } = getInputProps(fields.email, {
    type: "email",
    value: false,
    ariaAttributes: false,
  })

  // Neutral confirmation — never reveals whether the address exists.
  if (lastResult?.status === "success") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Check your inbox</CardTitle>
          <CardDescription>
            If an account exists for that email, we&apos;ve sent a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={signInHref} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>Enter your email and we&apos;ll send you a reset link.</CardDescription>
      </CardHeader>
      <CardContent>
        <form {...getFormProps(form)} action={action} className="flex flex-col gap-5">
          <TextField
            key={emailKey}
            {...emailProps}
            label="Email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            error={fields.email.errors?.[0]}
          />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link href={signInHref} className="font-medium text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
