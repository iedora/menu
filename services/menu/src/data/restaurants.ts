import type { LocalizedText, Theme } from "@iedora/contracts";
import type { Kysely, Selectable } from "kysely";

import type { Restaurant } from "../domain";
import type { MenuDB } from "../schema";
import type { Restaurants } from "../db.generated";

// Restaurant reads shared by the public path and (Stage B) the scoping
// middleware. Mutations live in data/restaurants.write.ts (Stage B).

export const RESTAURANT_COLS = [
  "id",
  "tenant_id",
  "name",
  "slug",
  "description",
  "description_i18n",
  "logo_url",
  "banner_url",
  "theme",
  "default_language",
  "supported_languages",
  "onboarding_completed_at",
  "updated_at",
] as const;

// Bun's SQL returns jsonb columns as raw strings; parse them (tolerating an
// already-parsed value).
function parseJson<T>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v as T;
}

type RestaurantRow = Pick<Selectable<Restaurants>, (typeof RESTAURANT_COLS)[number]>;

export function toRestaurant(r: RestaurantRow): Restaurant {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? "",
    descriptionI18n: parseJson<LocalizedText>(r.description_i18n),
    logoUrl: r.logo_url ?? "",
    bannerUrl: r.banner_url ?? "",
    theme: parseJson<Theme>(r.theme),
    defaultLanguage: r.default_language,
    supportedLanguages: r.supported_languages,
    onboardingCompletedAt: r.onboarding_completed_at ? new Date(r.onboarding_completed_at) : null,
    updatedAt: new Date(r.updated_at),
  };
}

// restaurantBySlug loads a restaurant without tenant scoping — the public read
// path and the scoping middleware (which enforces tenancy itself) share it.
// Returns undefined when none matches.
export async function restaurantBySlug(
  db: Kysely<MenuDB>,
  slug: string,
): Promise<Restaurant | undefined> {
  const row = await db
    .selectFrom("restaurants")
    .select([...RESTAURANT_COLS])
    .where("slug", "=", slug)
    .executeTakeFirst();
  return row ? toRestaurant(row) : undefined;
}
