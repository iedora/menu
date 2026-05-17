import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/features/auth/adapters/better-auth-instance'

export const { POST, GET } = toNextJsHandler(auth)
