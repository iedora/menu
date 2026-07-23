import { ResetPasswordForm } from "./reset-password-form.tsx"

// The emailed reset link lands here with `?token=…` (built by the auth service
// from the tenant's app origin + reset path).
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  return <ResetPasswordForm token={token ?? ""} signInHref="/sign-in" />
}
