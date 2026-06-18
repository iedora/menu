import { localizedText, theme } from "@iedora/contracts";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { menusWithCounts } from "../../data/restaurants.write";
import { menuTree } from "../../data/tree";
import type { MenuDeps } from "../../deps";
import type { MenuEnv } from "../../middleware";
import { seedSample } from "../../seed";
import {
  completeOnboarding,
  deleteRestaurant,
  renameSlug,
  updateIdentity,
} from "../../service";

const identityPatch = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  descriptionI18n: localizedText.optional(),
  theme: theme.optional(),
  defaultLanguage: z.string().optional(),
  supportedLanguages: z.array(z.string()).optional(),
});

// Scoped restaurant-identity slice: everything under /restaurants/{slug} that
// acts on the restaurant as a whole. Relies on the parent `scoped` middleware
// (restaurant resolved + tenancy enforced). Ports the restaurant-scoped handlers
// of Go internal/menu/httpapi/admin.go.
export function restaurantRoutes(deps: MenuDeps) {
  return new Hono<MenuEnv>()
    .get("/", async (c) => {
      const rest = c.get("restaurant");
      return c.json({ restaurant: rest, menus: await menusWithCounts(deps.db.db, rest.id) });
    })
    .patch("/", zValidator("json", identityPatch), async (c) => {
      const rest = c.get("restaurant");
      await deps.limiter.allow("identity", `org:${rest.tenantId}`);
      return c.json(await updateIdentity(deps, rest, c.req.valid("json")));
    })
    .delete("/", async (c) => {
      await deleteRestaurant(deps, c.get("restaurant"), c.get("user").userId);
      return c.json({ ok: true });
    })
    .post("/slug", zValidator("json", z.object({ slug: z.string() })), async (c) => {
      await renameSlug(deps, c.get("restaurant"), c.get("user").userId, c.req.valid("json").slug);
      return c.json({ ok: true });
    })
    .post("/complete-onboarding", async (c) => {
      await completeOnboarding(deps, c.get("restaurant"));
      return c.json({ ok: true });
    })
    .post("/seed", async (c) => c.json({ menuId: await seedSample(deps, c.get("restaurant")) }))
    .get("/tree", async (c) => {
      const rest = c.get("restaurant");
      return c.json({
        menus: await menuTree(deps.db.db, rest.id, false),
        defaultLanguage: rest.defaultLanguage,
        supportedLanguages: rest.supportedLanguages,
      });
    });
}
