import 'server-only'
import { requireAdmin as _requireAdmin } from './use-cases/require-admin'

/**
 * Public API of Genkan's platform-admin slice. Every /admin page starts
 * with `requireAdmin()`; the other helpers live in `./use-cases/*` and are
 * imported directly by the pages that need them (no `cache()` wrappers —
 * admin pages are inherently low-traffic).
 */
export const requireAdmin = _requireAdmin

export type {
  AdminUserRow,
  AdminUserDetail,
  AdminUserSession,
  AdminUserOrgMembership,
} from './use-cases/list-users'

export type {
  AdminOrganizationRow,
  AdminOrganizationDetail,
  AdminOrganizationMember,
  AdminOrganizationInvitation,
} from './use-cases/list-organizations'

export type {
  AdminOAuthClientRow,
  AdminOAuthClientDetail,
} from './use-cases/list-applications'

export type { AdminGrantRow } from './use-cases/list-grants'
export type { AdminSessionRow } from './use-cases/list-sessions'
// The audit trail moved to a dedicated slice at `@/features/audit` once a
// real `audit_log` table landed. See that slice's README.
