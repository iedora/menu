import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/features/auth/adapters/better-auth-instance'
import { resolveSafeReturnTo } from '../_lib/safe-return-to'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in' }

type SearchParams = Promise<{ return_to?: string }>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { return_to: rawReturnTo } = await searchParams
  const returnTo = resolveSafeReturnTo(rawReturnTo)

  // Already signed in? Bounce straight to the destination so a follow link
  // from a product app doesn't dead-end on the login form.
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect(returnTo)

  return <LoginForm returnTo={returnTo} />
}
