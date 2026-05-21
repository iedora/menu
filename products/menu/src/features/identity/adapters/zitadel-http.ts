import 'server-only'
import { SpanStatusCode } from '@opentelemetry/api'
import { meter, tracer } from '@iedora/observability'
import { env } from '@/shared/env'
import { log } from '@/shared/log'
import type { IdentityGateway, Organization } from '../ports'

/**
 * Per-endpoint latency histogram for outbound Zitadel REST calls. The
 * fetch instrumentation auto-emits an `HTTP POST` span per call, but the
 * span name there is generic; this histogram gives us a per-endpoint
 * breakdown filterable by `endpoint=list-orgs|create-org|add-member`.
 *
 * `iedora.zitadel.*` namespace so dashboards filtering by `iedora.*`
 * pick it up alongside the other custom metrics in the estate. Unit
 * `ms` — same as Next 16's auto `http.server.request.duration`.
 */
const zitadelCallDuration = meter.createHistogram(
  'iedora.zitadel.call_duration_ms',
  {
    description:
      'Latency of outbound Zitadel management/admin API calls (per logical endpoint).',
    unit: 'ms',
  },
)

/**
 * Per-endpoint outcome counter. Buckets:
 *   - success: HTTP 2xx + parsed body shape matched expectation.
 *   - empty:   HTTP 2xx but the body had no usable result (treated as
 *              "no orgs" / "couldn't create org"). Distinct from failure
 *              because it's not necessarily an error — a brand-new user
 *              legitimately has zero org memberships.
 *   - failed:  network error, non-2xx response, or JSON parse error.
 *              The call() helper coerces these to null at the boundary.
 */
const zitadelCalls = meter.createCounter('iedora.zitadel.calls_total', {
  description:
    'Outbound Zitadel API calls, grouped by endpoint and outcome (success | empty | failed).',
  unit: 'call',
})

type ZitadelEndpoint = 'list-orgs' | 'create-org' | 'add-member'
type ZitadelOutcome = 'success' | 'empty' | 'failed'

/**
 * Run `fn` under a named span and record (latency, outcome) per call.
 * The outcome string is derived inside `fn` — pass it back via the
 * returned object so we can stamp the right counter label even when
 * the call returns null instead of throwing.
 */
async function recordZitadelCall<T>(
  endpoint: ZitadelEndpoint,
  attrs: Record<string, string>,
  fn: () => Promise<{ value: T; outcome: ZitadelOutcome }>,
): Promise<T> {
  return tracer.startActiveSpan(`zitadel.${endpoint}`, async (span) => {
    span.setAttribute('iedora.zitadel.endpoint', endpoint)
    for (const [k, v] of Object.entries(attrs)) span.setAttribute(k, v)
    const startedAt = performance.now()
    let outcome: ZitadelOutcome = 'failed'
    try {
      const { value, outcome: o } = await fn()
      outcome = o
      span.setAttribute('iedora.zitadel.outcome', outcome)
      if (outcome === 'failed') {
        span.setStatus({ code: SpanStatusCode.ERROR })
      }
      return value
    } catch (err) {
      span.recordException(err as Error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      })
      throw err
    } finally {
      const elapsed = performance.now() - startedAt
      const labels = {
        'iedora.zitadel.endpoint': endpoint,
        'iedora.zitadel.outcome': outcome,
      }
      zitadelCallDuration.record(elapsed, labels)
      zitadelCalls.add(1, labels)
      span.end()
    }
  })
}

/**
 * Production IdentityGateway. Calls Zitadel's REST management API using
 * menu's IAM_OWNER service-account PAT (minted in TF by
 * `zitadel_personal_access_token.menu_sa`).
 *
 * Why the PAT and not the user's own access_token: a standard OIDC user
 * token doesn't carry the management-scope claims required to
 * `_search` memberships across orgs or create a new org at onboarding.
 * The PAT carries the menu_sa machine user's IAM_OWNER role.
 *
 * Errors are coerced to friendly return values (null / empty list / false)
 * because the call sites are server actions and DAL guards — they already
 * branch on missing data. We log unexpected failures so they show up in
 * the container logs.
 *
 * Endpoint set (subject to Zitadel deprecation watch — both v1 endpoints
 * still work in 4.15.x as of 2026-05):
 *   - POST /v2/users/{userId}/memberships/_search  (list memberships)
 *   - POST /admin/v1/orgs                          (create org)
 *   - POST /management/v1/orgs/{orgId}/members    (add user as ORG_OWNER)
 */
type SearchResponse<T> = { result?: T[]; details?: { totalResult?: string } }

type ZitadelMembership = {
  userId?: string
  // Exactly one of these is populated per row:
  iam?: { name?: string }
  orgId?: string
  orgName?: string
  projectId?: string
  projectGrantId?: string
  // Display fields, only populated for org-level rows in 2.x+
  displayName?: string
}

function slugify(name: string): string {
  // NFD splits accented chars into base + combining-mark; stripping the
  // marks gives a clean ASCII fallback (Café → cafe, München → munchen).
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

async function call<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const url = `${env.ZITADEL_ISSUER_URL.replace(/\/$/, '')}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.ZITADEL_MANAGEMENT_TOKEN}`,
        'content-type': 'application/json',
        accept: 'application/json',
        ...(init.headers ?? {}),
      },
      // Identity calls are user-scoped and short-lived; no Next caching.
      cache: 'no-store',
    })
  } catch (err) {
    log.error(
      { err, module: 'identity', method: init.method ?? 'GET', url },
      'zitadel call threw',
    )
    return null
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    log.error(
      {
        module: 'identity',
        method: init.method ?? 'GET',
        url,
        status: res.status,
        body,
      },
      'zitadel call non-2xx',
    )
    return null
  }
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

export const zitadelHttpIdentity: IdentityGateway = {
  async listOrganizations(userId) {
    return recordZitadelCall(
      'list-orgs',
      { 'iedora.zitadel.user_id': userId },
      async () => {
        const data = await call<SearchResponse<ZitadelMembership>>(
          `/v2/users/${encodeURIComponent(userId)}/memberships/_search`,
          {
            method: 'POST',
            body: JSON.stringify({
              query: { offset: '0', limit: 100, asc: true },
            }),
          },
        )
        if (!data) return { value: [] as Organization[], outcome: 'failed' }
        if (!data.result || data.result.length === 0) {
          return { value: [] as Organization[], outcome: 'empty' }
        }
        // Filter to org-level memberships. IAM-level / project-level rows are
        // visible in this list too but don't represent a tenant for menu.
        const out: Organization[] = []
        for (const row of data.result) {
          if (!row.orgId) continue
          const name = row.orgName ?? row.displayName ?? row.orgId
          out.push({ id: row.orgId, name, slug: slugify(name) })
        }
        return {
          value: out,
          outcome: out.length === 0 ? 'empty' : 'success',
        }
      },
    )
  },

  async createOrganization(userId, name, _slug) {
    return recordZitadelCall(
      'create-org',
      { 'iedora.zitadel.user_id': userId },
      async () => {
        // 1. Create the org.
        const created = await call<{ id?: string }>(`/admin/v1/orgs`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        })
        if (!created?.id) {
          return { value: null as Organization | null, outcome: 'failed' }
        }

        // 2. Add the user as ORG_OWNER of the new org. The header switches
        //    the management API's org context to the freshly minted one.
        // Nested inside its own span so the two-step transaction is
        // visible in OO — the cascade view will show create-org →
        // add-member as parent → child.
        const added = await recordZitadelCall(
          'add-member',
          {
            'iedora.zitadel.user_id': userId,
            'iedora.zitadel.org_id': created.id,
          },
          async () => {
            const result = await call<unknown>(
              `/management/v1/orgs/${encodeURIComponent(created.id!)}/members`,
              {
                method: 'POST',
                headers: { 'x-zitadel-orgid': created.id! },
                body: JSON.stringify({ userId, roles: ['ORG_OWNER'] }),
              },
            )
            return {
              value: result,
              outcome: (result === null ? 'failed' : 'success') as ZitadelOutcome,
            }
          },
        )
        if (added === null) {
          log.error(
            {
              module: 'identity',
              organizationId: created.id,
              userId,
              event: 'org_created_member_add_failed',
            },
            'org created but member add failed — manual recovery may be needed',
          )
          // Don't roll back — leaking an empty org on the IdP is preferable
          // to leaving the user without a tenant on second-try. Pre-customer.
        }

        return {
          value: {
            id: created.id,
            name,
            slug: slugify(name),
          } as Organization,
          // Outer outcome: success only when BOTH calls succeeded. The
          // member-add failure path is visible separately via the
          // nested span's own outcome label.
          outcome: added === null ? 'failed' : 'success',
        }
      },
    )
  },

  async setActiveOrganization(_userId, _organizationId) {
    // Zitadel doesn't model "the user's active org" — a user can be a
    // member of N orgs and the choice is client-side. Menu's identity
    // slice picks the first membership today. Future multi-membership
    // would back this with a tiny `user_preferences` table or a Zitadel
    // user metadata write. Today: no-op.
    return true
  },
}
