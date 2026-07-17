import type { PaymentGateway } from "@iedora/billing";
import type { Auditor, Database, ServiceVerifier } from "@iedora/menu-kit";

import type { BillingConfig } from "./config";
import type { BillingDB } from "./schema";

// Cross-slice dependencies wired once at boot and handed to each feature slice.
// (Service-wide infrastructure — the DB handle, token verifier, auditor, the
// payment gateway — lives here; feature-specific logic lives in its slice.)
export interface BillingDeps {
  db: Database<BillingDB>;
  verifier: ServiceVerifier; // verifies internal service tokens on every route
  auditor: Auditor; // OutboxWriter — records into the billing DB's outbox
  gateway: PaymentGateway; // provider-agnostic payments (ManualGateway; Stripe later)
  gatewayProvider: string; // the wired gateway's name, recorded on each charge
  cfg: BillingConfig;
}
