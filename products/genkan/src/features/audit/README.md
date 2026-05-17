# audit slice

Append-only platform audit trail. Distinct from the webhook bus
(`features/webhooks`): webhooks notify *other products*, the audit log
records *for human operators* — compliance, review, incident response.

## When to append

Append one row immediately after a meaningful admin or identity mutation
succeeds. The full list of action literals lives in
[`types.ts`](./types.ts) (`AuditEvent` union). Call sites today:

- `app/admin/users/[id]/actions.ts` — ban / unban / role change /
  impersonate / delete
- `app/admin/organizations/actions.ts` — create
- `app/admin/organizations/[id]/actions.ts` — update / delete /
  invite-as-member-add / remove member
- `app/admin/applications/actions.ts` — register
- `app/admin/applications/[id]/actions.ts` — update / delete
- `app/admin/webhooks/actions.ts` — register / update / delete
- `app/admin/grants/actions.ts` — revoke (admin)
- `app/(authed)/profile/actions.ts` — revoke (self)

## Public API

```ts
import { record, recordFromRequest, list } from '@/features/audit'

// inside a server action, after the mutation succeeded:
await recordFromRequest(
  { action: 'user.ban', targetId, payload: { reason, expires } },
  { id: session.user.id, role: 'admin' },
)
```

`record(event, ctx)` takes a pre-resolved `AuditContext`; use it when the
action already pulled IP / UA off the request for another reason.
`recordFromRequest(event, actor)` is sugar that reads `next/headers` for
you.

## Failure policy

Audit writes are best-effort but never silently swallowed. `record()`
throws on DB error. The action wrapping it MUST convert that into a
`{ ok: false, error }` result so the admin sees the failure — otherwise
we lose audit fidelity without anyone noticing.

## Pagination + filtering

`list()` accepts an `AuditListQuery`:

- `actorEmail` — substring (ILIKE) on the joined `user.email`
- `actions` — multi-select on the action literal
- `targetType` — exact match on `target_type`
- `targetId` — substring (ILIKE) on `target_id`
- `since` / `until` — inclusive lower / upper bound on `occurred_at`
- `limit` — default 50, cap 200
- `cursor` — `(occurredAt, id)` returned by a previous call

Pagination is keyset: ordered by `(occurred_at desc, id desc)`. The
returned `nextCursor` is `null` when there are no more rows.

## Schema

See `audit_log` in `src/shared/db/schema.ts`. Indexes on `(actor_id)`,
`(target_type, target_id)`, `(action)`, `(occurred_at)` keep the
filter + cursor query plan stable.
