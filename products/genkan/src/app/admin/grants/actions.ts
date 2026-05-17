'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { requireAdmin } from '@/features/admin'
import { emit } from '@/features/webhooks'
import { db } from '@/shared/db/client'
import {
  oauthAccessToken,
  oauthConsent,
  oauthRefreshToken,
} from '@/shared/db/schema'
import { recordAdminEvent } from '../_lib/audit'

type Result = { ok: true } | { ok: false; error: string }

function toMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object') {
    const obj = e as { message?: unknown }
    if (typeof obj.message === 'string') return obj.message
  }
  return fallback
}

/**
 * Revoke a grant: delete the consent row + invalidate every outstanding
 * token issued under (user, client). The OAuth provider hot-paths read
 * the consent on every authorize; nuking it means the next request must
 * pass through the consent screen again (or fail if the user is gone).
 */
export async function revokeGrantAction(
  consentId: string,
): Promise<Result> {
  const adminSession = await requireAdmin()
  // Resolve (userId, clientId) BEFORE the delete so the audit payload
  // survives the cascade.
  let auditPayload: { user_id: string; client_id: string } | null = null
  try {
    const [consent] = await db
      .select({
        clientId: oauthConsent.clientId,
        userId: oauthConsent.userId,
      })
      .from(oauthConsent)
      .where(eq(oauthConsent.id, consentId))
      .limit(1)
    if (!consent) return { ok: false, error: 'Grant not found.' }
    if (consent.userId) {
      auditPayload = { user_id: consent.userId, client_id: consent.clientId }
    }

    await db.transaction(async (tx) => {
      await tx.delete(oauthConsent).where(eq(oauthConsent.id, consentId))
      if (consent.userId) {
        await tx
          .delete(oauthAccessToken)
          .where(
            and(
              eq(oauthAccessToken.clientId, consent.clientId),
              eq(oauthAccessToken.userId, consent.userId),
            ),
          )
        await tx
          .delete(oauthRefreshToken)
          .where(
            and(
              eq(oauthRefreshToken.clientId, consent.clientId),
              eq(oauthRefreshToken.userId, consent.userId),
            ),
          )
      }
    })
    if (consent.userId) {
      await emit({
        event: 'grant.revoked',
        payload: {
          user_id: consent.userId,
          client_id: consent.clientId,
        },
      })
    }
  } catch (e) {
    return {
      ok: false,
      error: toMessage(e, 'Could not revoke grant.'),
    }
  }
  if (auditPayload) {
    const audit = await recordAdminEvent(
      {
        action: 'grant.revoke',
        targetId: consentId,
        payload: auditPayload,
      },
      adminSession,
    )
    if (!audit.ok) return audit
  }
  revalidatePath('/admin/grants')
  return { ok: true }
}
