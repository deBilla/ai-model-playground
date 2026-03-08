import { NextResponse } from 'next/server'
import { authService } from '@/lib/modules/auth'
import { RegisterRequestSchema } from '@/lib/modules/auth/auth.dto'
import { signToken, setSessionCookie, getGuestFromRequest, clearGuestCookie } from '@/lib/auth'
import { withJsonBody } from '@/lib/route-guards'

export const POST = withJsonBody(RegisterRequestSchema, async (req, data) => {
  try {
    const guestUserId = getGuestFromRequest(req)
    const user = guestUserId
      ? await authService.registerFromGuest(guestUserId, data)
      : await authService.register(data)

    const token = signToken(user.id)
    const res = NextResponse.json({ user }, { status: 201 })
    setSessionCookie(res, token)
    clearGuestCookie(res)
    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed'
    return NextResponse.json({ error: message }, { status: 409 })
  }
})
