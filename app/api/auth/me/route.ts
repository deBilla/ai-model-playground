import { NextResponse } from 'next/server'
import { authService } from '@/lib/modules/auth'
import { unauthorized } from '@/lib/auth'
import { withSessionAuth } from '@/lib/route-guards'

export const GET = withSessionAuth(async (_req, { userId }) => {
  const user = await authService.me(userId)
  if (!user) return unauthorized()
  return NextResponse.json({ user })
})
