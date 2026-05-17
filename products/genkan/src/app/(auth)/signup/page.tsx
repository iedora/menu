import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/features/auth/adapters/better-auth-instance'
import { resolveSafeReturnTo } from '../_lib/safe-return-to'
import { SignupForm } from './signup-form'

export const metadata = { title: 'Sign up' }

type SearchParams = Promise<{ return_to?: string }>

export default async function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { return_to: rawReturnTo } = await searchParams
  const returnTo = resolveSafeReturnTo(rawReturnTo)

  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect(returnTo)

  return <SignupForm returnTo={returnTo} />
}
