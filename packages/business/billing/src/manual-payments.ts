import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, ilike, type SQL } from 'drizzle-orm'
import { getCoreDb, recordAudit, type AuditActor } from '@iedora/auth'
import type { ProductId } from '@iedora/brand'

import { schema } from './schema'
import {
  type Currency,
  type ManualPaymentMethod,
  BILLING_AUDIT_EVENTS,
  DEFAULT_CURRENCY,
} from './literals'

/**
 * Manual-payment primitives — admin-recorded offline payments. Each
 * write emits an audit row through `recordAudit`; deletes also audit
 * with the deleted snapshot in `meta.deleted` so the ledger has a
 * complete trail even after a row is gone.
 *
 * Discount math lives in `paymentDiscount()` here so every caller
 * (admin list, tenant card, future reports) computes the same number.
 * Plan list prices are read from the caller's plan registry — this
 * module stays product-agnostic and takes the `monthlyCents` as input.
 */

const { manualPayment } = schema

export type ManualPayment = typeof manualPayment.$inferSelect

export type RecordManualPaymentInput = {
  tenantId: string
  product: ProductId
  planCode: string
  paidAt?: Date
  validMonths: number
  amountCents: number
  currency?: Currency
  method: ManualPaymentMethod
  campaignTag?: string | null
  notes?: string | null
  /** Admin who recorded the payment. */
  actor: AuditActor
}

export async function recordManualPayment(
  input: RecordManualPaymentInput,
): Promise<ManualPayment> {
  if (input.validMonths < 1) {
    throw new Error('[billing/manual-payment] validMonths must be >= 1')
  }
  if (input.amountCents < 0) {
    throw new Error('[billing/manual-payment] amountCents must be >= 0')
  }
  const db = getCoreDb()
  const id = randomUUID()
  const now = new Date()
  const paidAt = input.paidAt ?? now
  const [row] = await db
    .insert(manualPayment)
    .values({
      id,
      tenantId: input.tenantId,
      product: input.product,
      planCode: input.planCode,
      paidAt,
      validMonths: input.validMonths,
      amountCents: input.amountCents,
      currency: input.currency ?? DEFAULT_CURRENCY,
      method: input.method,
      campaignTag: input.campaignTag ?? null,
      notes: input.notes ?? null,
      createdByUserId: input.actor.userId,
      createdAt: now,
    })
    .returning()
  if (!row) {
    throw new Error('[billing/manual-payment] insert returned no row')
  }
  await recordAudit({
    event: BILLING_AUDIT_EVENTS.MANUAL_PAYMENT_RECORDED,
    outcome: 'success',
    actor: input.actor,
    target: { tenantId: input.tenantId },
    meta: {
      paymentId: id,
      product: input.product,
      planCode: input.planCode,
      paidAt: paidAt.toISOString(),
      validMonths: input.validMonths,
      amountCents: input.amountCents,
      currency: row.currency,
      method: input.method,
      campaignTag: input.campaignTag ?? null,
    },
    important: true,
  })
  return row
}

export type ListManualPaymentsFilter = {
  tenantId?: string
  product?: ProductId
  method?: ManualPaymentMethod
  /** Substring match on `campaign_tag` (ILIKE). */
  campaign?: string
  limit?: number
  offset?: number
}

export async function listManualPayments(
  filter: ListManualPaymentsFilter = {},
): Promise<ManualPayment[]> {
  const db = getCoreDb()
  const limit = Math.min(filter.limit ?? 50, 200)
  const offset = Math.max(filter.offset ?? 0, 0)
  const conditions: SQL[] = []
  if (filter.tenantId) conditions.push(eq(manualPayment.tenantId, filter.tenantId))
  if (filter.product) conditions.push(eq(manualPayment.product, filter.product))
  if (filter.method) conditions.push(eq(manualPayment.method, filter.method))
  if (filter.campaign) {
    conditions.push(ilike(manualPayment.campaignTag, `%${filter.campaign}%`))
  }
  return db
    .select()
    .from(manualPayment)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(manualPayment.paidAt))
    .limit(limit)
    .offset(offset)
}

/**
 * Most recent manual payment for (tenant, product). Used by the
 * tenant billing card to surface the active payment + computed
 * discount. Returns null when the tenant has never been recorded.
 */
export async function getLatestManualPayment(input: {
  tenantId: string
  product: ProductId
}): Promise<ManualPayment | null> {
  const db = getCoreDb()
  const rows = await db
    .select()
    .from(manualPayment)
    .where(
      and(
        eq(manualPayment.tenantId, input.tenantId),
        eq(manualPayment.product, input.product),
      ),
    )
    .orderBy(desc(manualPayment.paidAt))
    .limit(1)
  return rows[0] ?? null
}

export async function deleteManualPayment(input: {
  paymentId: string
  actor: AuditActor
}): Promise<void> {
  const db = getCoreDb()
  // Snapshot before delete so the audit row carries the full deleted
  // record — otherwise the timeline loses the data the moment the
  // row goes.
  const before = await db
    .select()
    .from(manualPayment)
    .where(eq(manualPayment.id, input.paymentId))
    .limit(1)
  const existing = before[0]
  if (!existing) return
  await db
    .delete(manualPayment)
    .where(eq(manualPayment.id, input.paymentId))
  await recordAudit({
    event: BILLING_AUDIT_EVENTS.MANUAL_PAYMENT_DELETED,
    outcome: 'success',
    actor: input.actor,
    target: { tenantId: existing.tenantId },
    meta: { paymentId: existing.id, deleted: existing },
    important: true,
  })
}

// ─── Derived helpers — no DB, no I/O. ─────────────────────────────

/**
 * Discount metadata for a payment vs. the plan's list price. Returns
 * `{ expected, paid, discountCents, discountPct }`. Plan list price
 * is passed as `monthlyCents` so this module stays product-free.
 *
 * `discountPct` is 0..100 rounded to 0.1. A negative discount is
 * possible if the customer paid above list — surfaced honestly so
 * the UI can render "overpaid" instead of silently flooring at 0.
 */
export function paymentDiscount(
  payment: Pick<ManualPayment, 'amountCents' | 'validMonths'>,
  monthlyCents: number,
): {
  expectedCents: number
  paidCents: number
  discountCents: number
  discountPct: number
} {
  const expectedCents = monthlyCents * payment.validMonths
  const discountCents = expectedCents - payment.amountCents
  const discountPct =
    expectedCents > 0
      ? Math.round((discountCents / expectedCents) * 1000) / 10
      : 0
  return {
    expectedCents,
    paidCents: payment.amountCents,
    discountCents,
    discountPct,
  }
}

/**
 * Validity window end = `paidAt + validMonths`. UTC arithmetic; the
 * UI is responsible for any locale-specific formatting.
 */
export function paymentValidUntil(
  payment: Pick<ManualPayment, 'paidAt' | 'validMonths'>,
): Date {
  const d = new Date(payment.paidAt)
  d.setMonth(d.getMonth() + payment.validMonths)
  return d
}
