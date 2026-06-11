---
name: reorder-positions
description: Use when implementing or modifying drag-and-drop reordering for any of the position-bearing tables (menu, category, item). Encodes the canonical pattern — recompute affected positions in a single transaction, scope by parent, renumber when gaps grow.
---

# reorder-positions

Hard rule #7 from `AGENTS.md`: drag-and-drop reordering uses integer `position` columns (per parent). On reorder, recompute positions for affected rows in a single transaction. Renumber periodically if gaps grow.

## Tables with `position`

- `menu.position` — scoped per `restaurantId`
- `category.position` — scoped per `menuId`
- `item.position` — scoped per `categoryId`

The "scope" is the parent ID — uniqueness/ordering is only meaningful within that parent.

## Pattern

```ts
import { db } from '@/lib/db'
import { item } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

// `orderedIds` is the new order produced by the @dnd-kit handler.
async function reorderItems(categoryId: string, orderedIds: string[]) {
  // 1. Auth FIRST — see tenant-scope-audit. Resolve restaurantId then guard.
  // const { restaurantId } = await categoryRestaurant(categoryId)
  // await requireRestaurantAccess(restaurantId)

  // 2. Single transaction. Use multiples of 10 (or 100) to leave gaps for
  //    cheaper future inserts without renumbering every row.
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(item)
        .set({ position: (i + 1) * 10 })
        .where(and(eq(item.id, orderedIds[i]), eq(item.categoryId, categoryId)))
    }
  })
}
```

## Why a transaction

A partial reorder leaves inconsistent state visible to the public menu render. The transaction ensures readers see either the old order or the full new order — never a half-applied shuffle.

## When to renumber

If you do many single-item inserts using `MAX(position) + 1`, gaps stay tight. If you do many drag-reorders that compress positions (e.g. always assigning `+1` next to a neighbor), gaps shrink. Periodically renumber to multiples of 10 for the whole parent scope:

```ts
await db.transaction(async (tx) => {
  const rows = await tx
    .select({ id: item.id })
    .from(item)
    .where(eq(item.categoryId, categoryId))
    .orderBy(item.position)
  for (let i = 0; i < rows.length; i++) {
    await tx.update(item).set({ position: (i + 1) * 10 }).where(eq(item.id, rows[i].id))
  }
})
```

## Don't

- Don't reorder across parents (e.g. moving an item to a different category) by just updating `position` — also update `categoryId` (and `restaurantId` if needed) in the same transaction.
- Don't trust the client to send positions; the client sends the **order** (an array of IDs), and the server computes positions.
- Don't skip the tenant-scope guard (`requireRestaurantAccess`) before the transaction.
