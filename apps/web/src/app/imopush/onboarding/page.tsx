import { redirect } from 'next/navigation'

/**
 * imopush onboarding — stub.
 *
 * Organizations are cross-product (one better-auth org backs every
 * iedora surface), so for now we hand callers off to the menu
 * onboarding wizard which already provisions the org + sets the active
 * tenant. After it completes the user gets an active tenant and
 * `/imopush/dashboard` resolves.
 *
 * Replace this with a dedicated imopush onboarding flow once the
 * product needs imopush-specific setup (e.g. portal credentials, agent
 * profile).
 */
export default function ImopushOnboarding() {
  redirect('/menu/onboarding')
}
