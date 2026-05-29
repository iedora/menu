import 'server-only'
import { getSession as getCoreSession, getActiveTenantId } from '@iedora/auth/server'
import type { AuthGateway, Session } from '../ports'

async function readSession(): Promise<Session | null> {
  const s = await getCoreSession()
  if (!s?.user) return null

  const activeTenantId = await getActiveTenantId({
    sessionId: s.session.id,
    userId: s.user.id,
  })

  return {
    user: {
      id: s.user.id,
      email: s.user.email,
      name: s.user.name,
      scopes: (s.user as { scopes?: string[] | null }).scopes ?? null,
    },
    session: {
      id: s.session.id,
      activeTenantId,
    },
  }
}

export const coreAuthGateway: AuthGateway = {
  getSession: readSession,
}
