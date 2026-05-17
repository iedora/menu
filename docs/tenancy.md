# Tenancy model

Where do restaurants live in the identity graph, and how do we evolve when the model strains? This doc captures the decision and the migration paths so future us doesn't have to re-derive it.

## The shape today (v1)

```
genkan.user ──(member, role)──> genkan.organization
                                       │
                                       │ id (UUID)
                                       ▼
                             menu.restaurant.organizationId
```

**One organization → N restaurants.** A user can belong to multiple organizations (Better Auth's `organization` plugin makes this a many-to-many through `genkan.member`). A restaurant references exactly one organization by UUID; menu's DB has no foreign key — the reference is logical, since genkan and menu live in separate databases.

**Default onboarding behaviour** (`menu/src/app/onboarding/actions.ts`):

- First restaurant ever: create an organization for the user (`identity.createOrganization`), then create the restaurant under it.
- Second / Nth restaurant: create the restaurant under the user's existing active organization. No new organization is minted.

In short: **a user with multiple restaurants has ONE organization by default, with N restaurants inside it.**

## Why this fits

Four archetypes drove the choice. The current pattern handles three of them well:

| Archetype | Description | Current pattern serves it? |
|---|---|---|
| **A — Solo owner** | One person, one restaurant, no team | ✅ trivial — org is invisible chrome |
| **B — Group owner** | One person, 3-5 restaurants, manages everything personally | ✅ one org, switch between restaurants inside it |
| **C — Hired manager** | Works for a group, has access to only 1 of the 5 restaurants | ❌ no per-restaurant role gating today (everyone in the org sees everything) |
| **D — Co-workers** | Owner + chef + waiter share access to one restaurant | ✅ all members of the same org, see the same restaurants |

Three of four covered, with one known gap (C). That gap is acceptable because no current or near-term customer is asking for it.

## The escape hatch (add when needed, not now)

We do let users *opt into* a separate organization for a new restaurant. The trigger is a single branch in the +Restaurant flow:

> Add this restaurant in a **new organization** (separate team, separate billing)

If checked, `completeOnboarding` calls `identity.createOrganization` again before creating the restaurant. Genkan ends up with a second org for the same user; menu's `restaurant.organizationId` points at the new one. Plans, members, and invitations are then independent from the original org.

This branch is the answer to:
- "I want my pop-up bar billed separately from my main restaurant" (separate billing)
- "These two restaurants have completely different staff" (separate teams)

Keep it as a deliberate, named UI affordance — not the default — so the simple case stays simple.

## Patterns we considered and why we didn't pick them

| Pattern | Shape | Why not |
|---|---|---|
| **User = Org (1:1)** | One implicit personal tenant per user | Can't share a restaurant with a teammate. Kills archetype D. |
| **Org-per-restaurant (N:N)** | Each restaurant is its own org | Multi-restaurant owners would switch orgs 3× to navigate; invitations multiply; per-org billing balloons; "edit all my restaurants' hours" becomes a cross-org flow. Heavy tax for a problem (C) we don't have. |
| **Org → Project hierarchy** | Members at the org level, members at the project level, two layers of roles | The right *eventual* model. See migration path below. Costs we don't want to pay yet: two permission layers in every DAL guard, two-tier UX in every member list. |
| **Personal + Shared orgs** | Every user gets a hidden personal org plus optional shared orgs | The right model once we have any "personal vs team" distinction. None exists today. The first paying customer asking "can I keep my recipe-testing menu private?" is the signal to flip. |

## Migration paths

Two evolutions are likely. Both are deliberately cheap from the current shape.

### Migration A — Pattern 2 → Pattern 4 (per-restaurant roles)

**When**: archetype C arrives — a customer wants to give a manager access to only 1 of their 5 restaurants.

**The shape that gets added**:

```
genkan.organization ──> genkan.member          (org-wide membership, role)
                                ↘
                                  menu.restaurant_member  (per-restaurant role, optional)
```

`menu.restaurant_member` is a *menu-owned* table because the restaurant is menu's domain. Rows reference both `restaurant_id` (menu's) and `user_id` (genkan's UUID, no FK across DBs).

**Authorization rule** (read in this order):

1. If the user has a row in `menu.restaurant_member` for this restaurant, that's their role.
2. Else, fall back to their `genkan.member` role at the org level.
3. Else, no access.

**Migration steps**:

1. Add `menu.restaurant_member (restaurant_id, user_id, role, created_at)` in a regular Drizzle migration.
2. Backfill is empty by default — every existing user keeps full access via the org-level rule.
3. Extend `requireRestaurantAccess` in menu's DAL to check `restaurant_member` first.
4. Add an "Invite to this restaurant only" affordance in the existing Team UI.

**Reversibility**: drop the table; the org-level role is the canonical fallback.

**What does NOT change**:
- The `organization` / `member` tables in genkan
- Billing (still per-org)
- The OAuth claims (`organizations`, `role`)

This is why we picked Pattern 2: the migration to 4 is purely additive. We don't have to restructure existing tables, rewrite tokens, or change the OIDC claims.

### Migration B — Pattern 2 → Pattern 5 (personal + shared)

**When**: a customer wants to separate personal/draft work from production. Or we want a free-tier "personal menu testing" lane that doesn't share quota with their paid restaurants.

**The shape that gets added**:

- Every new user signup auto-creates a `personal` org alongside the user row (genkan's signup hook).
- Existing users get a one-time backfill: every existing org with a single owner-only member becomes their `personal` org. Orgs with multiple members or non-owner roles stay as shared orgs.
- Add `organization.type: "personal" | "shared"` (or just a boolean `is_personal`) — the UI hides personal orgs from "team" listings but keeps them present for billing/quota purposes.

**Backfill rule for the one-time migration**:

```sql
-- pseudo, illustrative
UPDATE genkan.organization SET type='personal'
WHERE id IN (
  SELECT organization_id FROM genkan.member m1
  WHERE m1.role='owner'
    AND NOT EXISTS (SELECT 1 FROM genkan.member m2
                    WHERE m2.organization_id=m1.organization_id
                      AND m2.user_id != m1.user_id)
);
UPDATE genkan.organization SET type='shared' WHERE type IS NULL;
```

**Reversibility**: drop the `type` column; treat every org uniformly again.

**What does NOT change**:
- `restaurant.organizationId` — still points at a genkan org
- The OIDC scopes, claims, JWT shape
- Billing primitives (just a new "personal" tier maybe)

Like Migration A, this is purely additive.

### Migration C — Pattern 2 → multi-level hierarchy (group · brand · restaurant)

**When**: a customer like LVMH walks in. Multiple brands (Gucci, Versace) each owning multiple menus; some staff scoped to a single menu, some to a single brand, some across the whole group; cross-cutting roll-up billing.

**Data shape**:

```
genkan.organization
  ├ LVMH       parent_id: NULL          (the group)
  ├ Gucci      parent_id: LVMH          (a brand)
  └ Versace    parent_id: LVMH          (a brand)

genkan.member (user, organization, role)
  Sofia       → LVMH    owner             ← cross-brand admin
  Manel       → Gucci   member            ← all Gucci menus
  Manel       → Versace member            ← + scoped via restaurant_member to one menu
  Carlos      → Gucci   member            ← scoped via restaurant_member

menu.restaurant.organizationId  → Gucci or Versace  (never the group)
menu.restaurant_member          → Migration A's table
```

**Schema additions** (cumulative on top of Migration A):

- `genkan.organization.parent_id` — nullable `text`, references `organization.id`. Drizzle migration adds the column; backfill null on existing rows. Better Auth ignores unknown columns; expose via `additionalFields` for type-safety.
- Nothing else. `restaurant_member` from Migration A is already enough for per-restaurant scoping.

**DAL guard for "can user U access restaurant R?"** (read top-to-bottom, first match wins):

1. User has a row in `restaurant_member` for R → use that role.
2. User has a row in `restaurant_member` for some other restaurant in R's org → no access (scoped membership rule).
3. User is `member|admin|owner` of R's organization → use that role.
4. User is `admin|owner` of any ancestor organization of R's org (walk `parent_id` chain) → use that role.
5. Otherwise → no access.

**Worked examples on the LVMH data above**:

| Question | Path | Outcome |
|---|---|---|
| Can Carlos see Menu C of Gucci? | Rule 1 matches `(Carlos, Menu C)` | ✅ as cook |
| Can Carlos see Menu A of Gucci? | Rule 1: no. Rule 2: yes — Carlos has a scoped row in Gucci. | ❌ |
| Can Manel see Menu A of Gucci? | Rule 1: no. Rule 2: no (no Manel rows in Gucci). Rule 3: yes — Manel is org-level member of Gucci. | ✅ |
| Can Manel see Menu E of Versace? | Rule 1: no. Rule 2: yes — Manel has a scoped row in Versace. | ❌ |
| Can Sofia see Menu C of Gucci? | Rule 1: no. Rule 2: no. Rule 3: no. Rule 4: yes — Sofia owns LVMH; Gucci.parent_id = LVMH. | ✅ |

**OIDC claim**: extend `getAdditionalUserInfoClaim` to include the org chain so consumers (menu, .NET API) get the hierarchy in the JWT:
```json
"organizations": [
  { "id": "...Gucci", "name": "Gucci", "role": "member", "parent_id": "...LVMH" },
  { "id": "...LVMH",  "name": "LVMH",  "role": "owner",  "parent_id": null }
]
```

**Billing roll-up**: when the plan is on the parent org (`LVMH.plan = "casa-group"`), child orgs (`Gucci.plan = "inherited"`) defer to the parent. Cheap: a use-case `getEffectivePlan(orgId)` walks `parent_id` looking for the first non-inherited plan.

**Reversibility**: `parent_id` is nullable + ignored by Better Auth's core. Drop the column, drop the rule-4 branch in the DAL, hierarchy disappears without touching anyone's existing data.

**What does NOT change**:
- Pattern 2's restaurant ownership (`restaurant.organizationId` still points at the BRAND, never the group)
- OAuth client scopes / authorize flow
- Existing members, existing orgs without a `parent_id` continue to work
- Migration A's `restaurant_member` table — used as-is for the leaf-scoped case

**Cost**: ~2 hours of work end-to-end (column + DAL extension + UI exposes the chain in the org switcher). No data migration on existing tenants since `parent_id` defaults to null.

This is the right call if LVMH-style customers arrive. The current model gracefully extends into it; we don't need to design it now.

### Migration D — Pattern 2 → Pattern 3 (one org per restaurant)

**When**: never. We don't anticipate this. Documented for completeness so we remember we chose against it.

If we ever did need it: each existing org with N restaurants gets split into N orgs. Tooling: a "Split this organization" admin action that creates clone orgs, copies members, reassigns restaurants. Painful migration — every member needs N invitations or N membership rows. Plans need to be cloned. **Don't do this** unless billing and access genuinely don't model otherwise.

## Where the code expresses this

- `products/menu/src/features/identity/use-cases/create-organization.ts` — the call menu makes to genkan when an org needs minting
- `products/menu/src/app/onboarding/actions.ts` — branches: "first restaurant?" → create-org; otherwise → reuse the active org
- `products/menu/src/features/auth/use-cases/require-restaurant-access.ts` — the DAL guard that checks "does the caller's set of org IDs include this restaurant's org ID?"
- `products/genkan/src/features/auth/adapters/better-auth-instance.ts` — `getAdditionalUserInfoClaim` emits the `organizations` claim used by menu

When Migration A lands, `require-restaurant-access` gains a per-restaurant check ahead of the org check. When Migration B lands, the onboarding action gains an "is the active org personal?" branch.
