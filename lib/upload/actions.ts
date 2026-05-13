'use server'

import { revalidatePath } from 'next/cache'
import { revalidateRestaurant } from '@/lib/menu/cached'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireRestaurantAccess } from '@/features/auth'
import { db } from '@/lib/db'
import { item, restaurant } from '@/lib/db/schema'
import {
  TARGET_CONSTRAINTS,
  buildKey,
  getStorage,
  type AssetTarget,
} from '@/lib/storage'
import type { PresignedUpload } from '@/lib/storage/types'

const targetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('restaurant-logo'),
    restaurantId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('restaurant-banner'),
    restaurantId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('item-photo'),
    restaurantId: z.string().min(1),
    itemId: z.string().min(1),
  }),
])

const presignRequestSchema = z.object({
  target: targetSchema,
  contentType: z.string().min(1),
  contentLengthBytes: z.number().int().positive(),
})

const commitRequestSchema = z.object({
  target: targetSchema,
  key: z.string().min(1),
  publicUrl: z.string().url(),
})

const clearRequestSchema = z.object({ target: targetSchema })

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

// Presign a PUT URL for the browser. Validates constraints + auth before
// returning anything signable, so an attacker cannot enumerate the bucket.
export async function requestUploadUrl(
  input: unknown,
): Promise<Result<PresignedUpload>> {
  const parsed = presignRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { target, contentType, contentLengthBytes } = parsed.data

  const constraints = TARGET_CONSTRAINTS[target.kind]
  if (!constraints.acceptedMimeTypes.includes(contentType)) {
    return {
      ok: false,
      error: `Unsupported file type. Allowed: ${constraints.acceptedMimeTypes.join(', ')}`,
    }
  }
  if (contentLengthBytes > constraints.maxBytes) {
    return {
      ok: false,
      error: `File too large. Max ${(constraints.maxBytes / (1024 * 1024)).toFixed(0)} MB.`,
    }
  }

  await requireRestaurantAccess(target.restaurantId)
  if (target.kind === 'item-photo') {
    await assertItemBelongsToRestaurant(target.itemId, target.restaurantId)
  }

  const storage = await getStorage()
  const key = buildKey(target, contentType)
  const upload = await storage.presignPut(key, {
    contentType,
    contentLengthBytes,
  })
  return { ok: true, data: upload }
}

// Persist the new asset URL into the right column and best-effort delete the
// previous asset. The key MUST belong to the same restaurant tenant — we
// enforce that here so a stale presign cannot be redirected to another tenant.
export async function commitAsset(input: unknown): Promise<Result<{ url: string }>> {
  const parsed = commitRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { target, key, publicUrl } = parsed.data

  await requireRestaurantAccess(target.restaurantId)
  assertKeyBelongsToTarget(key, target)

  const storage = await getStorage()
  const previousUrl = await readCurrentAssetUrl(target)

  await writeAssetUrl(target, publicUrl)
  bustPaths(target)

  if (previousUrl) {
    const previousKey = storage.keyFromPublicUrl(previousUrl)
    if (previousKey && previousKey !== key) {
      await storage.delete(previousKey)
    }
  }

  return { ok: true, data: { url: publicUrl } }
}

// Clears the asset URL on the row and deletes the underlying object.
export async function clearAsset(input: unknown): Promise<Result<null>> {
  const parsed = clearRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { target } = parsed.data

  await requireRestaurantAccess(target.restaurantId)
  if (target.kind === 'item-photo') {
    await assertItemBelongsToRestaurant(target.itemId, target.restaurantId)
  }

  const storage = await getStorage()
  const previousUrl = await readCurrentAssetUrl(target)
  await writeAssetUrl(target, null)
  bustPaths(target)

  if (previousUrl) {
    const previousKey = storage.keyFromPublicUrl(previousUrl)
    if (previousKey) await storage.delete(previousKey)
  }

  return { ok: true, data: null }
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function assertKeyBelongsToTarget(key: string, target: AssetTarget): void {
  // The buildKey scheme always starts with `r/${restaurantId}/`. Any key that
  // doesn't, or that points to a different restaurant, is rejected.
  const expectedPrefix = `r/${target.restaurantId}/`
  if (!key.startsWith(expectedPrefix)) {
    throw new Error('Key does not belong to the target restaurant')
  }
}

async function assertItemBelongsToRestaurant(
  itemId: string,
  restaurantId: string,
): Promise<void> {
  const rows = await db
    .select({ id: item.id })
    .from(item)
    .where(and(eq(item.id, itemId), eq(item.restaurantId, restaurantId)))
    .limit(1)
  if (rows.length === 0) {
    throw new Error('Item does not belong to the restaurant')
  }
}

async function readCurrentAssetUrl(target: AssetTarget): Promise<string | null> {
  switch (target.kind) {
    case 'restaurant-logo': {
      const rows = await db
        .select({ url: restaurant.logoUrl })
        .from(restaurant)
        .where(eq(restaurant.id, target.restaurantId))
        .limit(1)
      return rows[0]?.url ?? null
    }
    case 'restaurant-banner': {
      const rows = await db
        .select({ url: restaurant.bannerUrl })
        .from(restaurant)
        .where(eq(restaurant.id, target.restaurantId))
        .limit(1)
      return rows[0]?.url ?? null
    }
    case 'item-photo': {
      const rows = await db
        .select({ url: item.imageUrl })
        .from(item)
        .where(eq(item.id, target.itemId))
        .limit(1)
      return rows[0]?.url ?? null
    }
  }
}

async function writeAssetUrl(target: AssetTarget, url: string | null): Promise<void> {
  switch (target.kind) {
    case 'restaurant-logo':
      await db
        .update(restaurant)
        .set({ logoUrl: url })
        .where(eq(restaurant.id, target.restaurantId))
      return
    case 'restaurant-banner':
      await db
        .update(restaurant)
        .set({ bannerUrl: url })
        .where(eq(restaurant.id, target.restaurantId))
      return
    case 'item-photo':
      await db
        .update(item)
        .set({ imageUrl: url })
        .where(and(eq(item.id, target.itemId), eq(item.restaurantId, target.restaurantId)))
      return
  }
}

async function bustPaths(target: AssetTarget): Promise<void> {
  // Slug isn't on the target — read it once so we can revalidate /r/[slug].
  const rows = await db
    .select({ slug: restaurant.slug })
    .from(restaurant)
    .where(eq(restaurant.id, target.restaurantId))
    .limit(1)
  const slug = rows[0]?.slug
  if (!slug) return
  revalidatePath(`/dashboard/r/${slug}`)
  revalidatePath(`/dashboard/r/${slug}/theme`)
  revalidateRestaurant(slug)
}
