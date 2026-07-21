import type { AuthNextConfig } from "@iedora/auth-sdk/next"

/** Tutor's wiring to the shared iedora auth service. Used by the server
 *  integration (lib/auth) and the refresh middleware. */
export const authConfig: AuthNextConfig = {
  baseUrl: process.env.AUTH_BASE_URL ?? "http://localhost:4000",
  tenant: process.env.AUTH_TENANT ?? "tutor",
  cookiePrefix: "tutor",
}
