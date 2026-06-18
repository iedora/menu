import { HTTPException } from "hono/http-exception";

/** 401 for any credential/session failure (don't leak which). */
export const unauthorized = (message = "invalid credentials"): HTTPException =>
  new HTTPException(401, { message });

/** Postgres unique-violation (e.g. duplicate email). Bun's PostgresError puts
 *  the SQLSTATE in `errno` (its `code` is the generic ERR_POSTGRES_SERVER_ERROR). */
export function isUniqueViolation(err: unknown): boolean {
  return (err as { errno?: unknown } | null)?.errno === "23505";
}
