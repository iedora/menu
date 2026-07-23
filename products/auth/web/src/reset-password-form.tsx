"use client"

import { getFormProps, getInputProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4"
import { Button } from "@iedora/ui/components/ui/button"
import { buttonVariants } from "@iedora/ui/components/ui/button-variants"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@iedora/ui/components/ui/card"
import { PasswordField } from "@iedora/ui/components/field"
import Link from "next/link"
import { useActionState, useState } from "react"

import { resetPasswordAction } from "./actions.ts"
import { PASSWORD_MIN, resetPasswordSchema } from "./schemas.ts"

export function ResetPasswordForm({ token, signInHref }: { token: string; signInHref: string }) {
  const [lastResult, action, pending] = useActionState(resetPasswordAction, undefined)
  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(resetPasswordSchema),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    onValidate: ({ formData }) => parseWithZod(formData, { schema: resetPasswordSchema }),
  })
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const { key: pwKey, ...pwProps } = getInputProps(fields.password, {
    type: "password",
    value: false,
    ariaAttributes: false,
  })
  const { key: confirmKey, ...confirmProps } = getInputProps(fields.confirm, {
    type: "password",
    value: false,
    ariaAttributes: false,
  })

  if (lastResult?.status === "success") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Password updated</CardTitle>
          <CardDescription>You can now sign in with your new password.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={signInHref} className={buttonVariants({ size: "lg", className: "w-full" })}>
            Sign in
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>Enter a new password for your iedora account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form {...getFormProps(form)} action={action} className="flex flex-col gap-5">
          <input type="hidden" name="token" value={token} />
          <PasswordField
            key={pwKey}
            {...pwProps}
            label="New password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={fields.password.errors ? undefined : `At least ${PASSWORD_MIN} characters`}
            error={fields.password.errors?.[0]}
            showLabel="Show password"
            hideLabel="Hide password"
          />
          <PasswordField
            key={confirmKey}
            {...confirmProps}
            label="Confirm password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={fields.confirm.errors?.[0]}
            showLabel="Show password"
            hideLabel="Hide password"
          />
          {form.errors && (
            <p className="text-[13px] text-destructive" role="alert">
              {form.errors[0]}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Updating…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
