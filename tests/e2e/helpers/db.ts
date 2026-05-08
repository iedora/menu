import postgres from 'postgres'

const TEST_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/metamenu_test'

let _sql: ReturnType<typeof postgres> | null = null

export function testDb() {
  if (!_sql) _sql = postgres(TEST_URL, { max: 4 })
  return _sql
}

export async function truncateAll() {
  const sql = testDb()
  await sql`
    TRUNCATE TABLE
      "item", "category", "menu", "restaurant",
      "invitation", "member", "organization",
      "session", "account", "verification", "user"
    RESTART IDENTITY CASCADE
  `
}

/**
 * Inserts an extra restaurant under an existing organization, bypassing the
 * Better Auth org-create flow. Returns the new restaurant id.
 *
 * Tests use `apiCreateAndActivateOrg` for the *first* restaurant in an org;
 * this helper exists for the rare case where a single org needs more than
 * one restaurant (multi-restaurant editorial-list assertions).
 */
export async function seedRestaurant(
  organizationId: string,
  name: string,
  slug: string,
  opts: { published?: boolean } = {},
): Promise<{ restaurantId: string }> {
  const sql = testDb()
  const [{ id }] = await sql<{ id: string }[]>`
    INSERT INTO restaurant (id, organization_id, name, slug, published, updated_at)
    VALUES (
      gen_random_uuid()::text,
      ${organizationId},
      ${name},
      ${slug},
      ${opts.published ?? false},
      now()
    )
    RETURNING id
  `
  return { restaurantId: id }
}

/**
 * Inserts a menu under a restaurant. Used for tests that need a menu without
 * the sample-seed action (which inserts categories and items too).
 */
export async function seedMenu(
  restaurantId: string,
  name: string,
  opts: { active?: boolean; position?: number } = {},
): Promise<{ menuId: string }> {
  const sql = testDb()
  const [{ id }] = await sql<{ id: string }[]>`
    INSERT INTO menu (id, restaurant_id, name, active, position, updated_at)
    VALUES (
      gen_random_uuid()::text,
      ${restaurantId},
      ${name},
      ${opts.active ?? true},
      ${opts.position ?? 0},
      now()
    )
    RETURNING id
  `
  return { menuId: id }
}

/**
 * Inserts a category and N items inside a menu. Items get sequential prices
 * and names so test assertions can be deterministic without hardcoding ids.
 *
 * Returns the category id for callers that want to chain further inserts.
 */
export async function seedCategoryWithItems(
  menuId: string,
  restaurantId: string,
  categoryName: string,
  itemNames: string[],
): Promise<{ categoryId: string; itemIds: string[] }> {
  const sql = testDb()
  const [{ id: categoryId }] = await sql<{ id: string }[]>`
    INSERT INTO category (id, menu_id, restaurant_id, name, position, updated_at)
    VALUES (
      gen_random_uuid()::text,
      ${menuId},
      ${restaurantId},
      ${categoryName},
      0,
      now()
    )
    RETURNING id
  `

  const itemIds: string[] = []
  for (let i = 0; i < itemNames.length; i++) {
    const [{ id }] = await sql<{ id: string }[]>`
      INSERT INTO item (
        id, category_id, restaurant_id, name,
        price_cents, currency, position, updated_at
      )
      VALUES (
        gen_random_uuid()::text,
        ${categoryId},
        ${restaurantId},
        ${itemNames[i]},
        ${(i + 1) * 100},
        'EUR',
        ${i},
        now()
      )
      RETURNING id
    `
    itemIds.push(id)
  }

  return { categoryId, itemIds }
}
