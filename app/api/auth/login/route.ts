import { NextResponse } from 'next/server'
import { authService } from '@/lib/modules/auth'
import { LoginRequestSchema } from '@/lib/modules/auth/auth.dto'
import { signToken, setSessionCookie, getGuestFromRequest, clearGuestCookie } from '@/lib/auth'
import { withJsonBody } from '@/lib/route-guards'

export const POST = withJsonBody(LoginRequestSchema, async (req, data) => {
  try {
    const { userId, user } = await authService.login(data)

    // Merge guest comparisons into this account (best-effort, non-blocking)
    const guestUserId = getGuestFromRequest(req)
    if (guestUserId && guestUserId !== userId) {
      authService.mergeGuestOnLogin(guestUserId, userId).catch(() => {/* non-critical */})
    }

    const token = signToken(userId)
    const res = NextResponse.json({ user })
    setSessionCookie(res, token)
    clearGuestCookie(res)
    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
})
