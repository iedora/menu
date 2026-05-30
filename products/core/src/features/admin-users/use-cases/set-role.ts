import { IEDORA_ADMIN_ROLE } from '@iedora/auth/role-presets'
import type { AdminUsersError, AdminUsersGateway } from '../ports'

/**
 * Allow-list of cross-tenant roles. `null` (or empty string) demotes
 * the user back to a regular tenant member with no cross-tenant
 * privileges. Sourced from the central role-preset constants — no
 * literal role strings here.
 */
export const ALLOWED_CROSS_TENANT_ROLES = [IEDORA_ADMIN_ROLE] as const
export type CrossTenantRole = (typeof ALLOWED_CROSS_TENANT_ROLES)[number]

export type SetRoleInput = {
  userId: string
  /** `null` clears the role. */
  role: CrossTenantRole | null
  callerUserId: string
}

export async function setUserRole(
  gateway: AdminUsersGateway,
  input: SetRoleInput,
): Promise<{ ok: true } | { ok: false; error: AdminUsersError }> {
  if (input.userId === input.callerUserId) {
    return { ok: false, error: { code: 'self-target' } }
  }
  await gateway.setRole({ userId: input.userId, role: input.role })
  return { ok: true }
}
