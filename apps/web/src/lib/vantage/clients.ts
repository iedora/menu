// Vantage's data layer — the three platform SDKs, wired once with a single
// platform-scoped service token. SERVER-ONLY: reads the service client secret
// from env; must never reach a client bundle. Import only from Server Components
// under src/app/vantage/.
//
// Direct SDK calls — no wrapper. auth-sdk = users/sessions, audit-sdk = what
// happened, email-sdk = what was sent. Vantage composes the three read views.
//
// Vantage lives in the PLATFORM app (iedora-web) — the natural home for a
// cross-product, cross-tenant super-admin console and its powerful token.

import { AuditClient } from "@iedora/audit-sdk"
import { createManageClient } from "@iedora/auth-sdk"
import { ServiceTokenSource } from "@iedora/auth-sdk/tokens"
import { EmailClient } from "@iedora/email-sdk"

function req(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Vantage: missing env ${name}`)
  return v
}

// One cached client-credentials source, shared by all three SDKs (same EdDSA
// service token, same audience). For a true cross-tenant super-admin this client
// must be PLATFORM-scoped (tenantId null) in the auth service's client registry.
const tokens = new ServiceTokenSource(
  req("AUTH_BASE_URL"),
  req("SERVICE_CLIENT_ID"),
  req("SERVICE_CLIENT_SECRET"),
)

/** auth-sdk /manage — users, sessions, organizations. */
export const manage = createManageClient({
  baseUrl: req("AUTH_BASE_URL"),
  token: () => tokens.token(),
})

/** audit-sdk — the audit log (GET /obs/events). */
export const audit = new AuditClient({ baseUrl: req("AUDIT_BASE_URL"), tokens })

/** email-sdk — the delivery log (GET /deliveries). */
export const email = new EmailClient({ baseUrl: req("EMAIL_BASE_URL"), tokens })
