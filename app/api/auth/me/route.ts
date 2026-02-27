import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/modules/auth'
import { getUserFromRequest, unauthorized } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const userId = getUserFromRequest(req)
  if (!userId) return unauthorized()

  const user = await authService.me(userId)
  if (!user) return unauthorized()

  return NextResponse.json({ user })
}
