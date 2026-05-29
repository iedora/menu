import 'server-only'
import { cache } from 'react'
import { coreAuthGateway } from './adapters/core-auth'
import { verifySession as _verifySession } from './use-cases/verify-session'
import { getEffectiveOrganizationId as _getEffectiveOrganizationId } from './use-cases/get-effective-organization-id'
import { requireActiveOrganization as _requireActiveOrganization } from './use-cases/require-active-organization'

/**
 * Public API of the auth slice. Wrappers bind the @iedora/auth-backed
 * AuthGateway and React-cache each call so guards reused in a single
 * render hit the wire once.
 */

export const getSession = cache(() => coreAuthGateway.getSession())

export const verifySession = cache(() => _verifySession(coreAuthGateway))

export const getEffectiveOrganizationId = cache(() =>
  _getEffectiveOrganizationId(coreAuthGateway),
)

export const requireActiveOrganization = cache(() =>
  _requireActiveOrganization(coreAuthGateway),
)

export type { AuthGateway, Session } from './ports'
