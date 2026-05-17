import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/features/auth/adapters/better-auth-instance'
import { env } from '@/shared/env'

/**
 * Landing. Genkan isn't a destination — it's a transition. Signed-in users
 * bounce to the configured default (typically the menu app); anonymous users
 * land at /login.
 */
export default async function RootPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect(env.DEFAULT_RETURN_TO)
  redirect('/login')
}
