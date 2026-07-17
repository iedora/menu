import type {
  Charge,
  ChargeInput,
  PaymentGateway,
  Refund,
  RefundInput,
} from "@iedora/billing";

// The gateway seam. The service depends on @iedora/billing's PaymentGateway
// INTERFACE; a concrete adapter is wired at boot. ManualGateway is the default:
// it settles instantly with no external processor — for cash/manual payments an
// operator records after the fact, and for local/dev/tests. A StripeGateway
// (its own package) drops in here unchanged when real card processing is wired.
export class ManualGateway implements PaymentGateway {
  private seq = 0;

  async charge(input: ChargeInput): Promise<Charge> {
    // No external call — the money moved out of band (cash/transfer); we just
    // record it as settled. The id is a stable local ref, not a provider id.
    return { id: `man_${Date.now().toString(36)}_${++this.seq}`, status: "paid", amount: input.amount };
  }

  async refund(input: RefundInput): Promise<Refund> {
    return {
      id: `man_re_${Date.now().toString(36)}_${++this.seq}`,
      status: "succeeded",
      // A manual refund is always full unless an amount is named.
      amount: input.amount ?? { amount: 0, currency: "USD" },
    };
  }
}

/** The gateway name recorded on each charge row (`charges.provider`). */
export const MANUAL_PROVIDER = "manual";
