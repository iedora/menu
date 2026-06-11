---
name: tenant-scope-audit
description: Use to audit code (modified files, a PR diff, or a specific server file) for tenant-isolation violations. Checks every query touching restaurant/menu/category/item is preceded by requireRestaurantAccess (or requireRestaurantBySlug), and that no IDs from the client are trusted without re-checking ownership. Run before merging anything that adds or changes data-fetching code.
---

# tenant-scope-audit

Hard rule #1 from `AGENTS.md`: every query touching `restaurant`, `menu`, `category`, or `item` MUST filter by `restaurantId` AND verify the caller is a `member` of the parent `organization`. The canonical guard lives in `lib/dal.ts`.

## What to check

For each file under audit:

1. **Find tenant-table reads/writes.** Grep for `from(restaurant)`, `from(menu)`, `from(category)`, `from(item)`, plus `update(...)`/`delete(...)`/`insert(...)` on the same tables.
2. **For each match, walk upward** — does the same function (or a parent it awaits) call one of:
   - `requireRestaurantAccess(restaurantId)`
   - `requireRestaurantBySlug(slug)`
   - `requireActiveOrganization()` *plus* an explicit `organizationId` filter on the query
3. **Verify the ID source.** If `restaurantId` came from `params`, `searchParams`, a form body, or a JSON request, the guard must run BEFORE the query. Trusting a client-supplied ID without `requireRestaurantAccess` is the violation.
4. **Cross-tenant joins are illegal.** A query like `from(item).innerJoin(restaurant, ...)` without filtering both `restaurant.organizationId` AND `member.userId` is a leak.
5. **Server Actions and Route Handlers** count too. Layouts in Next 16 don't re-render on navigation (`AGENTS.md` rule #3) — auth in a layout does NOT cover a Server Action invoked from a child page.

## Output format

For each violation, report:
- File and line.
- Which table is touched.
- What guard is missing.
- The minimal fix (usually: `await requireRestaurantAccess(restaurantId)` at the top of the function).

If no violations, say so explicitly — silence is not a pass.

## Out of scope

- The public menu route at `app/r/[slug]/` reads by slug from a `published: true` restaurant. That's intentionally unauthenticated; flag it only if it ever returns unpublished rows or org-private fields.
- Better Auth tables (`user`, `session`, `member`, `organization`, etc.) — not tenant-scoped in the same way. Auth handles those.
