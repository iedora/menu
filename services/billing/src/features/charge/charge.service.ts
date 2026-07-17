import { money, splitByRate, zero } from "@iedora/billing";

import { type ChargeRecord, getCharge, insertCharge } from "../../data/charges";
import type { BillingDeps } from "../../deps";

// The generic charge: the one payment entry point every product uses. A platform
// charge (menu subscription — no payee, platform keeps the amount) and a
// marketplace charge (tutor lesson — payer=student, payee=tutor, fee=commission,
// net=payout) are the SAME flow: split the money, settle through the gateway,
// record the ledger row. Product policy (the fee rate, the amount) is passed in.
export interface CreateChargeInput {
  product: string;
  payer: string;
  /** Marketplace payee (e.g. the tutor). Omit for a platform-only charge. */
  payee?: string;
  amountCents: number;
  currency: string;
  /** Marketplace take-rate (0..1). With `payee`, splits gross → platform fee + payee net. */
  feeRate?: number;
  /** Provider customer + saved method for an off-session charge (Stripe). */
  customer?: string;
  paymentMethod?: string;
  offSession?: boolean;
  /** Dedupe: a retried request with the same key returns the existing charge. */
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export async function createCharge(
  deps: BillingDeps,
  input: CreateChargeInput,
  clientId: string,
): Promise<ChargeRecord> {
  const gross = money(input.amountCents, input.currency);
  // Marketplace charge splits gross into a platform fee + the payee's net;
  // a platform-only charge keeps the whole amount (net 0).
  const { fee, net } =
    input.payee != null && input.feeRate != null
      ? splitByRate(gross, input.feeRate)
      : { fee: gross, net: zero(input.currency) };

  const settled = await deps.gateway.charge({
    amount: gross,
    customer: input.customer,
    paymentMethod: input.paymentMethod,
    offSession: input.offSession,
    idempotencyKey: input.idempotencyKey,
  });

  const record = await insertCharge(deps.db.db, {
    product: input.product,
    payer: input.payer,
    payee: input.payee ?? null,
    gross,
    fee,
    net,
    status: settled.status,
    provider: deps.gatewayProvider,
    providerRef: settled.id,
    idempotencyKey: input.idempotencyKey ?? null,
    metadata: input.metadata ?? {},
  });

  await deps.auditor.record({
    action: "billing.charge.created",
    outcome: settled.status === "paid" ? "success" : "unknown",
    actor: { type: "service", id: clientId },
    tenantId: input.payer,
    targetType: "charge",
    targetId: record.id,
    meta: {
      product: input.product,
      amount_cents: record.amountCents,
      fee_cents: record.feeCents,
      status: record.status,
    },
  });
  return record;
}

export function fetchCharge(deps: BillingDeps, id: string): Promise<ChargeRecord | undefined> {
  return getCharge(deps.db.db, id);
}
