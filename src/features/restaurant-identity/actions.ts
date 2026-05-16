'use server'

import { revalidatePath } from 'next/cache'
import { requireRestaurantBySlug } from '@/features/auth'
import { revalidateRestaurant } from '@/features/menu-publishing'
import { enforceRateLimit } from '@/features/rate-limit'
import { drizzleIdentityWrite } from './adapters/drizzle'
import { updateTheme as runUpdateTheme } from './use-cases/update-theme'
import { updateLanguageSettings as runUpdateLanguageSettings } from './use-cases/update-language-settings'
import { updateIdentity as runUpdateIdentity } from './use-cases/update-identity'

/**
 * Server action shells — each one: auth guard → run use-case → revalidate.
 * Every mutation that affects the public menu calls `revalidateRestaurant`
 * (AGENTS.md hard rule #12). The dashboard path revalidation is kept on
 * purpose — tag-only invalidation is a later step in the migration.
 */

type ActionResult = { ok: true } | { ok: false; error: string }

async function gateIdentity(slug: string): Promise<
  | { ok: true; restaurantId: string }
  | { ok: false; error: string }
> {
  const { restaurant: r, organizationId } = await requireRestaurantBySlug(slug)
  const decision = await enforceRateLimit('identity', `org:${organizationId}`)
  if (!decision.ok) {
    return { ok: false, error: `Too many requests. Try again in ${decision.retryAfterSec}s.` }
  }
  return { ok: true, restaurantId: r.id }
}

export async function updateTheme(
  slug: string,
  input: unknown,
): Promise<ActionResult> {
  const guarded = await gateIdentity(slug)
  if (!guarded.ok) return guarded
  const res = await runUpdateTheme(drizzleIdentityWrite, {
    ...(typeof input === 'object' && input !== null ? input : {}),
    restaurantId: guarded.restaurantId,
  })
  if ('error' in res) return { ok: false, error: res.error }
  revalidatePath(`/dashboard/r/${slug}/theme`)
  revalidateRestaurant(slug)
  return { ok: true }
}

export async function updateLanguageSettings(
  slug: string,
  input: unknown,
): Promise<ActionResult> {
  const guarded = await gateIdentity(slug)
  if (!guarded.ok) return guarded
  const res = await runUpdateLanguageSettings(drizzleIdentityWrite, {
    ...(typeof input === 'object' && input !== null ? input : {}),
    restaurantId: guarded.restaurantId,
  })
  if ('error' in res) return { ok: false, error: res.error }
  revalidatePath(`/dashboard/r/${slug}`)
  revalidatePath(`/dashboard/r/${slug}/theme`)
  revalidateRestaurant(slug)
  return { ok: true }
}

export async function updateIdentity(
  slug: string,
  input: unknown,
): Promise<ActionResult> {
  const guarded = await gateIdentity(slug)
  if (!guarded.ok) return guarded
  const res = await runUpdateIdentity(drizzleIdentityWrite, {
    ...(typeof input === 'object' && input !== null ? input : {}),
    restaurantId: guarded.restaurantId,
  })
  if ('error' in res) return { ok: false, error: res.error }
  revalidatePath(`/dashboard/r/${slug}`)
  revalidatePath(`/dashboard/r/${slug}/theme`)
  revalidateRestaurant(slug)
  return { ok: true }
}
