import { z } from "zod";

// Mirrors the Go menu service wire format (internal/menu/*). The menu service
// validates its requests/responses against these; the public React page and the
// dashboard consume the inferred types (Phase 4 swaps products/menu onto them).

// --- shared scalars ---

// language code → translated value for one field; only non-default languages.
export const localizedText = z.record(z.string(), z.string());
export type LocalizedText = z.infer<typeof localizedText>;

// Public-page styling; schemaless passthrough (known keys validated on write).
export const theme = z.record(z.string(), z.unknown());
export type Theme = z.infer<typeof theme>;

// --- public read model (one language, no i18n maps) ---

export const publicVariant = z.object({
  label: z.string(),
  priceCents: z.number().int(),
});
export type PublicVariant = z.infer<typeof publicVariant>;

export const publicItem = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  priceCents: z.number().int(),
  currency: z.string(),
  imageUrl: z.string().optional(),
  tags: z.array(z.string()),
  variants: z.array(publicVariant),
});
export type PublicItem = z.infer<typeof publicItem>;

export const publicCategory = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  items: z.array(publicItem),
});
export type PublicCategory = z.infer<typeof publicCategory>;

export const publicMenu = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  categories: z.array(publicCategory),
});
export type PublicMenu = z.infer<typeof publicMenu>;

// GET /public/r/{slug} — the localized public payload the menu page renders.
export const publicPayload = z.object({
  restaurant: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    logoUrl: z.string().optional(),
    bannerUrl: z.string().optional(),
    theme: theme.optional(),
  }),
  menus: z.array(publicMenu),
  defaultLanguage: z.string(),
  supportedLanguages: z.array(z.string()),
  currentLanguage: z.string(),
});
export type PublicPayload = z.infer<typeof publicPayload>;
