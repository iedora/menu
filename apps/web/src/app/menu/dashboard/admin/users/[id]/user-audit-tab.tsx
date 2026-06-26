'use client'

import { loadUserAuditAction } from '@iedora/product-menu/features/restaurant-identity/actions'
import { LazyAuditLoader } from '../../_components/lazy-audit-loader'

/** Activity tab — everything the user did, across tenants + domains. */
export function UserAuditTab({ userId }: { userId: string }) {
  return <LazyAuditLoader arg={userId} loader={loadUserAuditAction} testId="admin-user-audit" />
}
