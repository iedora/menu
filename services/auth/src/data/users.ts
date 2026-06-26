import { type Kysely, type Selectable, sql } from "kysely";
import { HTTPException } from "hono/http-exception";

import type { AuthDB } from "../schema";
import { isUniqueViolation } from "../errors";

export type User = Selectable<AuthDB["users"]>;

// Single-column user lookup (the two public loaders differ only by the column).
function findUserBy(db: Kysely<AuthDB>, col: "email" | "id", value: string): Promise<User | undefined> {
  return db.selectFrom("users").selectAll().where(col, "=", value).executeTakeFirst();
}

export function findUserByEmail(db: Kysely<AuthDB>, email: string): Promise<User | undefined> {
  return findUserBy(db, "email", email);
}

export function findUserById(db: Kysely<AuthDB>, id: string): Promise<User | undefined> {
  return findUserBy(db, "id", id);
}

// The exact columns the admin Users list (toAdminUser) reads — NOT password_hash.
// Listed `users.`-qualified so they're unambiguous against the joined `m` alias.
const ADMIN_USER_COLS = [
  "users.id",
  "users.email",
  "users.name",
  "users.role",
  "users.banned",
  "users.ban_reason",
  "users.ban_expires_at",
  "users.email_verified_at",
  "users.created_at",
  "users.password_changed_at",
  "users.must_change_password",
] as const;

/** The user fields the admin mapper consumes — the projection of the list query
 *  and the common shape `toAdminUser` accepts (a full {@link User} satisfies it too). */
export type AdminUserFields = Pick<
  User,
  "id" | "email" | "name" | "role" | "banned" | "ban_reason" | "ban_expires_at" | "email_verified_at" | "created_at" | "password_changed_at" | "must_change_password"
>;

/** A user row plus how many tenants they belong to — the admin Users list. */
export type AdminUserRow = AdminUserFields & { tenant_count: number };

/** Search/list users for the staff Users CRM, newest first. `q` matches email
 *  or name (case-insensitive). `tenant_count` comes from a single pre-aggregated
 *  GROUP BY joined once (not a per-row correlated subquery) — one aggregate pass
 *  over memberships instead of N counts. Projects only the displayed columns, so
 *  the argon2 `password_hash` is never read into the result set. Capped at 200. */
export function listUsers(
  db: Kysely<AuthDB>,
  opts: { q?: string; limit?: number } = {},
): Promise<AdminUserRow[]> {
  const limit = opts.limit && opts.limit > 0 && opts.limit <= 200 ? opts.limit : 50;
  let q = db
    .selectFrom("users")
    .leftJoin(
      (eb) =>
        eb
          .selectFrom("memberships")
          .select(["user_id"])
          .select(sql<number>`count(*)::int`.as("c"))
          .groupBy("user_id")
          .as("m"),
      (join) => join.onRef("m.user_id", "=", "users.id"),
    )
    .select(ADMIN_USER_COLS)
    .select(sql<number>`coalesce(m.c, 0)`.as("tenant_count"));
  if (opts.q && opts.q.trim()) {
    const like = `%${opts.q.trim()}%`;
    q = q.where((eb) => eb.or([eb("email", "ilike", like), eb("name", "ilike", like)]));
  }
  return q.orderBy("created_at", "desc").limit(limit).execute();
}

export function createUser(
  db: Kysely<AuthDB>,
  input: { email: string; passwordHash: string; name?: string | null },
): Promise<User> {
  return db
    .insertInto("users")
    .values({ email: input.email, password_hash: input.passwordHash, name: input.name ?? null })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** The one "create a user" entry point: createUser with a duplicate-email unique
 *  violation mapped to a clean 409. Shared by register + ownership transfer so
 *  the conflict handling lives in a single place. Hash the password BEFORE the
 *  caller's tx (argon2 is expensive) and pass it in. */
export async function createUserOr409(
  db: Kysely<AuthDB>,
  input: { email: string; passwordHash: string; name?: string | null },
): Promise<User> {
  try {
    return await createUser(db, input);
  } catch (err) {
    if (isUniqueViolation(err)) throw new HTTPException(409, { message: "email already registered" });
    throw err;
  }
}

/** Sets a user's global role (e.g. "admin"). Used by the admin-email hook. */
export async function setRole(db: Kysely<AuthDB>, id: string, role: string): Promise<void> {
  await db
    .updateTable("users")
    .set({ role, updated_at: sql`now()` })
    .where("id", "=", id)
    .execute();
}

/** Set a new password hash. Every hash change stamps `password_changed_at` (the
 *  "last password change" the admin CRM + owner settings show) and, by default,
 *  clears the force-change flag. Pass `forceChange` to instead REQUIRE a change
 *  at next login (an admin-set temporary password). */
export async function updatePasswordHash(
  db: Kysely<AuthDB>,
  id: string,
  hash: string,
  opts: { forceChange?: boolean } = {},
): Promise<void> {
  await db
    .updateTable("users")
    .set({
      password_hash: hash,
      password_changed_at: sql`now()`,
      must_change_password: opts.forceChange ?? false,
      updated_at: sql`now()`,
    })
    .where("id", "=", id)
    .execute();
}

/** Flip the force-change flag without touching the password (admin "force a
 *  password change at next login"). */
export async function setMustChangePassword(db: Kysely<AuthDB>, id: string, value: boolean): Promise<void> {
  await db
    .updateTable("users")
    .set({ must_change_password: value, updated_at: sql`now()` })
    .where("id", "=", id)
    .execute();
}

export function listMemberships(
  db: Kysely<AuthDB>,
  userId: string,
): Promise<{ tenant_id: string; role: string }[]> {
  return db
    .selectFrom("memberships")
    .select(["tenant_id", "role"])
    .where("user_id", "=", userId)
    .orderBy("created_at")
    .execute();
}

/** True if the user is currently banned (port of domain.User.IsBanned). */
export function isBanned(u: User, now: Date): boolean {
  if (!u.banned) return false;
  if (u.ban_expires_at && new Date(u.ban_expires_at) < now) return false; // expired ban
  return true;
}
