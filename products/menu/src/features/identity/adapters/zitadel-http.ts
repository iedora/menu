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

type ZitadelEndpoint =
  | 'list-orgs'
  | 'create-org'
  | 'get-primary-org-meta'
  | 'set-primary-org-meta'
type ZitadelOutcome = 'success' | 'empty' | 'failed'

/**
 * Zitadel v2 user metadata stores bytes (base64-encoded on the wire). We
 * use the `primaryOrgId` key to remember which org a user "lives in" so
 * subsequent dashboard renders can resolve it in a single call — Zitadel's
 * mgmt-API membership search is org-scoped (only sees memberships within
 * the requester's current org context), so iterating every org per page
 * load would be the alternative and doesn't scale.
 */
const PRIMARY_ORG_ID_META_KEY = 'primaryOrgId'

function encodeMetaValue(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

function decodeMetaValue(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8')
}

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
 * token doesn't carry the management-scope claims required to create an
 * org or read user metadata across the instance. The PAT carries the
 * menu_sa machine user's IAM_OWNER role.
 *
 * Errors are coerced to friendly return values (null / empty list / false)
 * because the call sites are server actions and DAL guards — they already
 * branch on missing data. We log unexpected failures so they show up in
 * the container logs.
 *
 * Endpoint set (Zitadel v4 — the older `/admin/v1/orgs` and
 * `/v2/users/.../memberships/_search` routes from v2.x are 404 in v4):
 *   - POST /v2/organizations                                  (create org + add admins in one call)
 *   - POST /v2/organizations/_search                          (lookup org by id)
 *   - POST /zitadel.user.v2.UserService/ListUserMetadata      (read primaryOrgId)
 *   - POST /zitadel.user.v2.UserService/SetUserMetadata       (set primaryOrgId)
 */
type OrganizationRow = {
  id?: string
  name?: string
  primaryDomain?: string
}

type SearchResponse<T> = { result?: T[]; details?: { totalResult?: string } }

type MetadataEntry = { key?: string; value?: string }

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

async function readPrimaryOrgId(userId: string): Promise<string | null> {
  return recordZitadelCall(
    'get-primary-org-meta',
    { 'iedora.zitadel.user_id': userId },
    async () => {
      const data = await call<{ metadata?: MetadataEntry[] }>(
        `/zitadel.user.v2.UserService/ListUserMetadata`,
        {
          method: 'POST',
          body: JSON.stringify({ userId }),
        },
      )
      if (!data) return { value: null as string | null, outcome: 'failed' }
      const entry = data.metadata?.find(
        (m) => m.key === PRIMARY_ORG_ID_META_KEY && m.value,
      )
      if (!entry?.value) {
        return { value: null as string | null, outcome: 'empty' }
      }
      return { value: decodeMetaValue(entry.value), outcome: 'success' }
    },
  )
}

async function writePrimaryOrgId(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  return recordZitadelCall(
    'set-primary-org-meta',
    {
      'iedora.zitadel.user_id': userId,
      'iedora.zitadel.org_id': organizationId,
    },
    async () => {
      const result = await call<unknown>(
        `/zitadel.user.v2.UserService/SetUserMetadata`,
        {
          method: 'POST',
          body: JSON.stringify({
            userId,
            metadata: [
              {
                key: PRIMARY_ORG_ID_META_KEY,
                value: encodeMetaValue(organizationId),
              },
            ],
          }),
        },
      )
      return {
        value: result !== null,
        outcome: (result === null ? 'failed' : 'success') as ZitadelOutcome,
      }
    },
  )
}

export const zitadelHttpIdentity: IdentityGateway = {
  async listOrganizations(userId) {
    return recordZitadelCall(
      'list-orgs',
      { 'iedora.zitadel.user_id': userId },
      async () => {
        // Resolve the user's primary org via metadata (set by
        // createOrganization / setActiveOrganization). Zitadel's mgmt-API
        // membership search is org-scoped, so we keep our own pointer.
        const primaryOrgId = await readPrimaryOrgId(userId)
        if (!primaryOrgId) {
          return { value: [] as Organization[], outcome: 'empty' }
        }

        const data = await call<SearchResponse<OrganizationRow>>(
          `/v2/organizations/_search`,
          {
            method: 'POST',
            body: JSON.stringify({
              queries: [{ idQuery: { id: primaryOrgId } }],
            }),
          },
        )
        if (!data) return { value: [] as Organization[], outcome: 'failed' }
        const row = data.result?.[0]
        if (!row?.id) {
          return { value: [] as Organization[], outcome: 'empty' }
        }
        const name = row.name ?? row.id
        return {
          value: [{ id: row.id, name, slug: slugify(name) }],
          outcome: 'success',
        }
      },
    )
  },

  async createOrganization(userId, name, _slug) {
    return recordZitadelCall(
      'create-org',
      { 'iedora.zitadel.user_id': userId },
      async () => {
        // v2 OrganizationService.CreateOrganization: creates the org AND
        // attaches `admins[]` in a single transactional call. Eliminates
        // the v2.x split where add-member could fail and orphan an org.
        const created = await call<{ organizationId?: string }>(
          `/v2/organizations`,
          {
            method: 'POST',
            body: JSON.stringify({
              name,
              admins: [{ userId, roles: ['ORG_OWNER'] }],
            }),
          },
        )
        if (!created?.organizationId) {
          return { value: null as Organization | null, outcome: 'failed' }
        }

        // Stash the org id as the user's primary so subsequent dashboard
        // renders find it via listOrganizations. Best-effort — a failure
        // here is recoverable (next setActiveOrganization call will retry).
        const stored = await writePrimaryOrgId(userId, created.organizationId)
        if (!stored) {
          log.error(
            {
              module: 'identity',
              organizationId: created.organizationId,
              userId,
              event: 'primary_org_meta_write_failed',
            },
            'org created but primary-org metadata write failed — dashboard will fall back to onboarding until re-auth',
          )
        }

        return {
          value: {
            id: created.organizationId,
            name,
            slug: slugify(name),
          } as Organization,
          outcome: 'success',
        }
      },
    )
  },

  async setActiveOrganization(userId, organizationId) {
    return writePrimaryOrgId(userId, organizationId)
  },
}
