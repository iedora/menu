import { toNextJsHandler } from '@iedora/auth/next'

export const dynamic = 'force-dynamic'

async function getHandler() {
  const { auth } = await import('@iedora/auth')
  return toNextJsHandler(auth.handler)
}

export async function GET(req: Request) {
  return (await getHandler()).GET(req)
}

export async function POST(req: Request) {
  return (await getHandler()).POST(req)
}
