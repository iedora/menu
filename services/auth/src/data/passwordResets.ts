import { type Kysely, sql } from "kysely";

import type { AuthDB } from "../schema";

// Password-reset tokens: only the sha256 hash of the opaque token is ever
// stored (token_hash), mirroring the sessions table. Lookups and the throttle
// run against the hash; the raw token lives only in the email/link.

export function insertResetToken(
  db: Kysely<AuthDB>,
  input: { userId: string; tokenHash: Buffer; expiresAt: Date },
): Promise<void> {
  return db
    .insertInto("password_reset_tokens")
    .values({ user_id: input.userId, token_hash: input.tokenHash, expires_at: input.expiresAt })
    .execute()
    .then(() => undefined);
}

/** The active (unspent, unexpired) token row for a presented hash, if any. */
export function findActiveByHash(
  db: Kysely<AuthDB>,
  hash: Buffer,
): Promise<{ id: string; user_id: string } | undefined> {
  return db
    .selectFrom("password_reset_tokens")
    .select(["id", "user_id"])
    .where("token_hash", "=", hash)
    .where("claimed_at", "is", null)
    .where("expires_at", ">", sql<Date>`now()`)
    .executeTakeFirst();
}

/**
 * Marks one token spent, but ONLY if it is still unclaimed — the conditional
 * UPDATE is the single-use guard. Returns false on a concurrent double-spend.
 */
export async function claimToken(db: Kysely<AuthDB>, id: string): Promise<boolean> {
  const res = await db
    .updateTable("password_reset_tokens")
    .set({ claimed_at: sql`now()` })
    .where("id", "=", id)
    .where("claimed_at", "is", null)
    .executeTakeFirst();
  return (res.numUpdatedRows ?? 0n) > 0n;
}

/** Invalidates every other outstanding token for the user (defense in depth). */
export async function invalidateUserTokens(db: Kysely<AuthDB>, userId: string): Promise<void> {
  await db
    .updateTable("password_reset_tokens")
    .set({ claimed_at: sql`now()` })
    .where("user_id", "=", userId)
    .where("claimed_at", "is", null)
    .execute();
}

/** True if the user already has an unspent token newer than `sinceMs` (anti-flood). */
export async function hasRecentToken(
  db: Kysely<AuthDB>,
  userId: string,
  sinceMs: number,
): Promise<boolean> {
  const row = await db
    .selectFrom("password_reset_tokens")
    .select("id")
    .where("user_id", "=", userId)
    .where("claimed_at", "is", null)
    .where("created_at", ">", sql<Date>`now() - make_interval(secs => ${sinceMs / 1000})`)
    .executeTakeFirst();
  return row !== undefined;
}
