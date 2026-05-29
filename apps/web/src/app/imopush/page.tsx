import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import {
  getEffectiveOrganizationId,
  getSession,
} from '@iedora/product-imopush/features/auth'
import { IMOPUSH_PATHS } from '@iedora/product-imopush/url'
import LandingPage from './_components/landing/landing-page'

/**
 * imopush.iedora.com — the imopush product surface. `proxy.ts` rewrites
 * the `imopush.iedora.com` host into `/imopush/*` so the user-visible
 * URL stays clean. Signed-in callers go straight to the dashboard (or
 * onboarding if no active tenant); everyone else sees the landing.
 */

export const metadata: Metadata = {
  title: 'imopush — one listing, every portal',
  description:
    'Publish your property once on imopush and it lands on Idealista, Custojusto, OLX and Imovirtual automatically.',
}

export default async function ImopushSurface() {
  const session = await getSession()
  if (session) {
    const tenantId = await getEffectiveOrganizationId()
    if (!tenantId) redirect(IMOPUSH_PATHS.onboarding)
    redirect(IMOPUSH_PATHS.dashboard)
  }
  return <LandingPage />
}
