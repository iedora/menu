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
