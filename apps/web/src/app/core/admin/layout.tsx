import { requireScope } from '@iedora/product-core'
import { SCOPES, type Scope } from '@iedora/auth/scopes'
import { STAFF_ROLE_PRESETS, isStaffRole, type StaffRoleKey } from '@iedora/auth/role-presets'
import { AdminShell } from '@iedora/product-core/shared/ui/admin-shell'

/**
 * Admin chrome — runs at /core/admin/*. Gates on the
 * `staff:core:admin:read` scope (held by every staff role, missing
 * for tenant users). Each nested page tightens via `requireScope`
 * for the narrower verb the page touches.
 */
export default async function CoreAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireScope(SCOPES.core.staff.admin.read)
  const sessionRole = (session.user as { role?: string | null }).role ?? null
  const sessionExtra =
    ((session.user as { extraScopes?: string[] | null }).extraScopes ?? []) as
      readonly Scope[]
  const staffRoleLabel: StaffRoleKey | null = isStaffRole(sessionRole) ? sessionRole : null
  const fromRole: readonly Scope[] = staffRoleLabel
    ? STAFF_ROLE_PRESETS[staffRoleLabel]
    : []
  const userScopes: readonly Scope[] | null =
    staffRoleLabel === null && sessionExtra.length === 0
      ? null
      : sessionExtra.length === 0
        ? [...fromRole]
        : Array.from(new Set([...fromRole, ...sessionExtra]))
  return (
    <AdminShell
      userEmail={session.user.email}
      userScopes={userScopes}
      staffRoleLabel={staffRoleLabel}
    >
      {children}
    </AdminShell>
  )
}
