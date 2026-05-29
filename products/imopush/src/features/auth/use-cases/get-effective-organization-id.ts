import 'server-only'
import type { AuthGateway } from '../ports'

export async function getEffectiveOrganizationId(
  auth: AuthGateway,
): Promise<string | null> {
  const session = await auth.getSession()
  return session?.session.activeTenantId ?? null
}
