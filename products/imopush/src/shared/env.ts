import { z } from 'zod'

/**
 * imopush's env contract. Zod-validated at module load so missing keys
 * fail fast at boot, not on first request.
 *
 * Add new env vars here as imopush grows. Each goes through Tofu's
 * envFromTofu/envFromBWS in `infra/deploy/cmd/iedora/products.go`
 * (once imopush ships as a deployable).
 */
const envSchema = z.object({
  IMOPUSH_DATABASE_URL: z.string().url(),
})

export const env = envSchema.parse(process.env)
