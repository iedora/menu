'use server'

import { revalidatePath } from 'next/cache'
import { searchTenants, type Tenant } from '@iedora/auth'
import {
  actorFromSession,
  getSession,
  requireScope,
} from '@iedora/auth/server'
import { SCOPES } from '@iedora/auth/scopes'
import { PRODUCTS } from '@iedora/brand'
import {
  deleteManualPayment,
  isManualPaymentMethod,
  listManualPayments,
  recordManualPayment,
  type ManualPayment,
  type ManualPaymentMethod,
} from '@iedora/billing'

/**
 * Server actions backing `/core/admin/payments`. Every entry-point is
 * gated on `staff:core:billing:manage` (held by iedora-admin via the
 * staff:* wildcard). Audit rows are emitted downstream by the billing
 * primitives — no manual `recordAudit` here.
 */

const SCOPE = SCOPES.core.staff.billing.manage

export type TenantOption = { id: string; name: string }

export async function searchTenantsAction(
  query: string,
): Promise<TenantOption[]> {
  await requireScope(SCOPE)
  const rows = await searchTenants({ search: query, limit: 30 })
  return rows.map((t: Tenant) => ({ id: t.id, name: t.name }))
}

export type ListPaymentsFilter = {
  tenantId?: string
  method?: ManualPaymentMethod
  campaign?: string
}

export async function listPaymentsAction(
  filter: ListPaymentsFilter = {},
): Promise<ManualPayment[]> {
  await requireScope(SCOPE)
  return listManualPayments({
    tenantId: filter.tenantId,
    method: filter.method,
    campaign: filter.campaign,
    limit: 200,
  })
}

export type RecordPaymentInput = {
  tenantId: string
  planCode: string
  paidAt: string // ISO date (date input)
  validMonths: number
  amountCents: number
  method: ManualPaymentMethod | string
  campaignTag?: string | null
  notes?: string | null
}

export type RecordPaymentResult =
  | { ok: true; paymentId: string }
  | { ok: false; error: string }

export async function recordPaymentAction(
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  await requireScope(SCOPE)
  const session = await getSession()
  if (!session?.user) return { ok: false, error: 'no session' }

  if (!isManualPaymentMethod(input.method)) {
    return { ok: false, error: `invalid method: ${input.method}` }
  }
  if (!input.tenantId) return { ok: false, error: 'tenantId required' }
  if (!input.planCode) return { ok: false, error: 'planCode required' }
  const paidAt = new Date(input.paidAt)
  if (Number.isNaN(paidAt.getTime())) {
    return { ok: false, error: 'paidAt is not a valid date' }
  }

  try {
    const row = await recordManualPayment({
      tenantId: input.tenantId,
      // Today only the menu product has manual payments. When other
      // products go paid this becomes a form field.
      product: PRODUCTS.menu,
      planCode: input.planCode,
      paidAt,
      validMonths: input.validMonths,
      amountCents: input.amountCents,
      method: input.method,
      campaignTag: input.campaignTag?.trim() || null,
      notes: input.notes?.trim() || null,
      actor: actorFromSession(session),
    })
    revalidatePath('/core/admin/payments')
    revalidatePath('/menu/dashboard/billing')
    return { ok: true, paymentId: row.id }
  } catch (err) {
    console.error('[payments] record failed', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function deletePaymentAction(
  paymentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireScope(SCOPE)
  const session = await getSession()
  if (!session?.user) return { ok: false, error: 'no session' }
  try {
    await deleteManualPayment({
      paymentId,
      actor: actorFromSession(session),
    })
    revalidatePath('/core/admin/payments')
    revalidatePath('/menu/dashboard/billing')
    return { ok: true }
  } catch (err) {
    console.error('[payments] delete failed', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
