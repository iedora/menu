import { normalizeIP } from '@better-auth/core/utils'

/**
 * Extract the client IP, narrowed to a /64 for IPv6 so an attacker can't walk
 * a single /64 prefix to evade per-IP throttles. This mitigates the class of
 * bypass tracked as CVE-2026-45364 (Better Auth) and applies to any per-IP
 * limiter we run downstream of cloudflared.
 *
 * Only `cf-connecting-ip` is trusted: it is set by Cloudflare's edge and
 * stripped on incoming requests, so anything else (X-Forwarded-For,
 * X-Real-IP) is freely spoofable upstream of the tunnel. In dev/test we
 * fall back to `x-forwarded-for` so Playwright + Next dev still work.
 */
export function extractClientIp(req: Request): string | null {
  const raw =
    req.headers.get('cf-connecting-ip') ??
    (process.env.NODE_ENV !== 'production'
      ? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      : null)
  if (!raw) return null
  return normalizeIP(raw, { ipv6Subnet: 64 })
}
