import { hashPassword, verifyPassword } from "@iedora/server-kit";
import { HTTPException } from "hono/http-exception";

import { insertSession } from "../../data/sessions";
import { findUserByEmail, isBanned, listMemberships } from "../../data/users";
import type { AuthDeps } from "../../deps";
import { unauthorized } from "../../errors";
import { buildSession, mintTokens, type RequestMeta, type Tokens } from "../../session";

// A real argon2 hash, verified against on the no-such-user path to equalize
// timing and deny an account-enumeration oracle (ports Go service dummyHash).
const DUMMY_HASH = await hashPassword("timing-equalizer-placeholder");

// Login verifies credentials and opens a new session family. Ports Go service.Login.
export async function login(
  deps: AuthDeps,
  input: { email: string; password: string },
  meta: RequestMeta,
): Promise<Tokens> {
  const ua = meta.userAgent ?? undefined;
  const ip = meta.ipHash ?? undefined;

  const user = await findUserByEmail(deps.db.db, input.email);
  if (!user) {
    await verifyPassword(DUMMY_HASH, input.password).catch(() => false);
    void deps.auditor.record({
      action: "auth.session.login",
      outcome: "failure",
      userAgent: ua,
      ipHash: ip,
      meta: { email: input.email, reason: "no_user" },
    });
    throw unauthorized();
  }

  if (!(await verifyPassword(user.password_hash, input.password))) {
    void deps.auditor.record({
      action: "auth.session.login",
      outcome: "failure",
      actor: { type: "user", id: user.id },
      userAgent: ua,
      ipHash: ip,
      meta: { reason: "bad_password" },
    });
    throw unauthorized();
  }

  if (isBanned(user, new Date())) {
    void deps.auditor.record({
      action: "auth.session.login",
      outcome: "failure",
      actor: { type: "user", id: user.id },
      userAgent: ua,
      ipHash: ip,
      meta: { reason: "banned" },
    });
    throw new HTTPException(403, { message: "account banned" });
  }

  const memberships = await listMemberships(deps.db.db, user.id);
  const tenantId = memberships[0]?.tenant_id ?? null;
  const { session, token } = buildSession(user.id, tenantId, deps.cfg, meta);

  await deps.db.runInTx(async () => {
    await insertSession(deps.db.db, session);
    await deps.auditor.recordSync({
      action: "auth.session.login",
      actor: { type: "user", id: user.id },
      tenantId: tenantId ?? undefined,
      targetType: "user",
      targetId: user.id,
      userAgent: ua,
      ipHash: ip,
    });
  });

  return mintTokens(deps, user, session.familyId, tenantId, token, session.expiresAt);
}
