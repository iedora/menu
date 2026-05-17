/**
 * Genkan's environment surface — everything the auth service needs and nothing
 * else. Menu's env.ts owns S3, Redis, etc.; genkan never touches those.
 *
 * Add a new env var by extending `serverSchema` below and `.env.example`.
 */
import { z } from 'zod'

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.url(),

  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),

  // Production: ".iedora.com". Local dev: leave blank so the cookie stays
  // host-only (the browser refuses Domain= attributes on localhost).
  COOKIE_DOMAIN: z.string().optional(),

  // Comma-separated. Every product origin that should be signed-in to this
  // Genkan instance. Adding a new product = adding its origin here.
  TRUSTED_ORIGINS: z
    .string()
    .min(1)
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),

  // Fallback for sign-in completions without a ?return_to parameter.
  DEFAULT_RETURN_TO: z.url(),

  DISABLE_AUTH_RATE_LIMIT: z.enum(['true', 'false']).optional(),
})

type ServerEnv = z.infer<typeof serverSchema>

const SKIP =
  process.env.SKIP_ENV_VALIDATION === '1' ||
  process.env.SKIP_ENV_VALIDATION === 'true'

function parseEnv(): ServerEnv {
  if (SKIP) {
    return new Proxy({} as ServerEnv, {
      get(_target, key) {
        if (key === 'NODE_ENV') return 'production'
        if (key === 'TRUSTED_ORIGINS') return [] as unknown
        return ''
      },
    })
  }

  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('Invalid environment variables:')
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    }
    throw new Error('Environment validation failed')
  }
  return parsed.data
}

export const env: ServerEnv = parseEnv()
