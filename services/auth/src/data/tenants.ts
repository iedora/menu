import type { Kysely } from "kysely";

import type { AuthDB } from "../schema";

export async function createTenant(db: Kysely<AuthDB>, name: string): Promise<string> {
  const row = await db
    .insertInto("tenants")
    .values({ name })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

export async function addMembership(
  db: Kysely<AuthDB>,
  m: { userId: string; tenantId: string; role: string },
): Promise<void> {
  await db
    .insertInto("memberships")
    .values({ user_id: m.userId, tenant_id: m.tenantId, role: m.role })
    .execute();
}
