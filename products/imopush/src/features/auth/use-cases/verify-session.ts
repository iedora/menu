import 'server-only'
import { redirect } from 'next/navigation'
import { signInUrl } from '@iedora/product-core/url'
import type { AuthGateway } from '../ports'

export async function verifySession(auth: AuthGateway) {
  const session = await auth.getSession()
  if (!session?.user) {
    redirect(signInUrl())
  }
  return session
}
