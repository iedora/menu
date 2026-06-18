import { hashPassword } from "@iedora/server-kit";
import { HTTPException } from "hono/http-exception";

import { insertSession } from "../../data/sessions";
import { createUser } from "../../data/users";
import type { AuthDeps } from "../../deps";
import { isUniqueViolation } from "../../errors";
import { buildSession, mintTokens, type RequestMeta, type Tokens } from "../../session";

// Register creates a user (+ its audit event, atomically) then auto-logs them in
// with a fresh session. Ports Go auth service.Register.
export async function register(
  deps: AuthDeps,
  input: { email: string; password: string; name: string },
  meta: RequestMeta,
): Promise<Tokens> {
  const passwordHash = await hashPassword(input.password);

  const user = await deps.db.runInTx(async () => {
    let created;
    try {
      created = await createUser(deps.db.db, {
        email: input.email,
        passwordHash,
        name: input.name,
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new HTTPException(409, { message: "email already registered" });
      throw err;
    }
    await deps.auditor.recordSync({
      action: "auth.user.register",
      actor: { type: "user", id: created.id },
      targetType: "user",
      targetId: created.id,
      userAgent: meta.userAgent ?? undefined,
      ipHash: meta.ipHash ?? undefined,
    });
    return created;
  });

  // Auto-login: open a session (no audit — the register event is the record). A
  // brand-new user has no tenant yet; the post-onboarding refresh picks one up.
  const { session, token } = buildSession(user.id, null, deps.cfg, meta);
  await insertSession(deps.db.db, session);
  return mintTokens(deps, user, session.familyId, null, token, session.expiresAt);
}
