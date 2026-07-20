import { getSession, type Session } from "@iedora/api-client"
import { notFound } from "next/navigation"
import { cache } from "react"

// The global super-admin role, minted by the auth service (PLATFORM_ADMINS) and
// carried in the access-token `roles` claim (menu decodes it into Session.roles).
// Vantage gates on THIS — verified offline from the JWT — not on any product's
// moderator flag.
export const PLATFORM_ADMIN = "platform:admin"

/** Whether the current viewer is a platform super-admin. Cached per request. */
export const isSuperAdmin = cache(async (): Promise<boolean> => {
  const s = await getSession()
  return s?.roles.includes(PLATFORM_ADMIN) ?? false
})

/**
 * Gate a Vantage Server Component. Anyone who is not a platform super-admin —
 * signed out or just not privileged — gets 404, so the console stays invisible
 * rather than advertising itself with a redirect. Returns the verified session.
 */
export async function requireSuperAdmin(): Promise<Session> {
  const s = await getSession()
  if (!s?.roles.includes(PLATFORM_ADMIN)) notFound()
  return s
}
