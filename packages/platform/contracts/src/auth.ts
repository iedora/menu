import { z } from "zod";

// Mirrors the Go auth service wire format. The token response shape matches what
// the frontend's @iedora/api-client already decodes (TokenResponse), so the new
// Hono auth service stays drop-in compatible with the live frontend.

export const tokenResponse = z.object({
  accessToken: z.string(),
  expiresAt: z.string(), // RFC3339
  userId: z.string(),
  tenantId: z.string().optional(),
});
export type TokenResponse = z.infer<typeof tokenResponse>;

export const loginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequest>;

export const registerRequest = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});
export type RegisterRequest = z.infer<typeof registerRequest>;

// Forgot/reset password. The request only needs an email; the server always
// responds identically whether or not the account exists (no enumeration).
export const forgotPasswordRequest = z.object({
  email: z.string().email(),
});
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequest>;

// Reset confirmation: the opaque token from the emailed link + the new password
// (same policy as registration). The token is the only secret that authorizes
// the change.
export const resetPasswordRequest = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequest>;

export const createTenantRequest = z.object({ name: z.string().min(1) });
export type CreateTenantRequest = z.infer<typeof createTenantRequest>;

export const tenant = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional(),
});
export type Tenant = z.infer<typeof tenant>;

export const whoamiResponse = z.object({
  userId: z.string(),
  tenantId: z.string().optional(),
  roles: z.array(z.string()),
  email: z.string().optional(),
});
export type WhoamiResponse = z.infer<typeof whoamiResponse>;

export const serviceTokenResponse = z.object({
  accessToken: z.string(),
  expiresAt: z.string(),
  tokenType: z.literal("Bearer"),
});
export type ServiceTokenResponse = z.infer<typeof serviceTokenResponse>;

// Access-token claims (EdDSA), mirroring internal/auth/crypto/jwt.go Claims.
export const accessClaims = z.object({
  sub: z.string(),
  tid: z.string().optional(),
  sid: z.string().optional(),
  roles: z.array(z.string()).default([]),
  email: z.string().optional(),
  typ: z.literal("access"),
  iss: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
  exp: z.number(),
});
export type AccessClaims = z.infer<typeof accessClaims>;
