import { addMembership, createTenant } from "../../data/tenants";
import type { AuthDeps } from "../../deps";
import type { RequestMeta } from "../../session";

// Provisions a tenant with the caller as owner (+ audit), all in one tx. Ports
// service.CreateTenant. The caller's current access token doesn't carry the new
// tid — the client refreshes, which re-resolves the default tenant.
export async function createTenantForUser(
  deps: AuthDeps,
  userId: string,
  name: string,
  meta: RequestMeta,
): Promise<{ id: string; name: string }> {
  return deps.db.runInTx(async () => {
    const id = await createTenant(deps.db.db, name);
    await addMembership(deps.db.db, { userId, tenantId: id, role: "owner" });
    await deps.auditor.recordSync({
      action: "auth.tenant.created",
      actor: { type: "user", id: userId },
      tenantId: id,
      targetType: "tenant",
      targetId: id,
      userAgent: meta.userAgent ?? undefined,
      ipHash: meta.ipHash ?? undefined,
    });
    return { id, name };
  });
}
