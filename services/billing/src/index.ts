import {
  AuditClient,
  Database,
  expandFileSecrets,
  newServiceVerifier,
  parseEd25519PublicKey,
  runRelayService,
  ServiceClient,
  ServiceTokenSource,
} from "@iedora/menu-kit";

import { buildApp } from "./app";
import { loadConfig } from "./config";
import { expireDueSubscriptions } from "./features/expiry/expire.service";
import type { BillingDB } from "./schema";

const EXPIRY_SWEEP_MS = 60 * 60 * 1000; // hourly

expandFileSecrets();
const cfg = loadConfig();

const db = new Database<BillingDB>(cfg.billingDatabaseUrl);

const verifier = newServiceVerifier(
  await parseEd25519PublicKey(cfg.serviceJwtPublicKey),
  cfg.serviceJwtIssuer,
  cfg.serviceAudience,
);

// Audit sink: billing mints a service token from auth and POSTs events to the
// audit service (never its DB).
const auditTokens = new ServiceTokenSource(cfg.authBaseUrl, cfg.serviceClientId, cfg.serviceClientSecret);
const audit = new AuditClient(new ServiceClient(cfg.auditBaseUrl, auditTokens, "audit"));

// runRelayService owns the outbox writer/relay + graceful shutdown; audit events
// are delivered over HTTP via the sink above.
runRelayService({
  name: "iedora-billing",
  port: cfg.port,
  source: "billing",
  db,
  audit,
  build: ({ auditor }) => {
    // Expiry sweep: subscriptions past their period end drop to On Us (+ audit).
    // Run once at boot to catch anything missed while down, then hourly. The
    // sweep is idempotent and multi-instance safe (see expireDueSubscriptions).
    const sweep = () =>
      expireDueSubscriptions(db, auditor).catch((err: unknown) =>
        console.error(
          JSON.stringify({ level: "error", msg: "expiry sweep failed", err: String(err) }),
        ),
      );
    void sweep();
    setInterval(() => void sweep(), EXPIRY_SWEEP_MS).unref();
    return buildApp({ db, verifier, auditor, cfg });
  },
});
