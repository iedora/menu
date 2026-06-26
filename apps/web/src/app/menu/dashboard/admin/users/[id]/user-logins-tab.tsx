'use client'

import { loadUserLoginAttemptsAction } from '@iedora/product-menu/features/restaurant-identity/actions'
import { LazyAuditLoader } from '../../_components/lazy-audit-loader'

/** Logins tab — the user's sign-in attempts only (success + failure, with IP). */
export function UserLoginsTab({ userId }: { userId: string }) {
  return <LazyAuditLoader arg={userId} loader={loadUserLoginAttemptsAction} testId="admin-user-logins" />
}
