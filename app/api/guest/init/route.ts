import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/modules/auth'
import { historyService } from '@/lib/modules/history'
import {
  getUserFromRequest,
  getGuestFromRequest,
  signGuestToken,
  setGuestCookie,
} from '@/lib/auth'
import { withRateLimit } from '@/lib/rateLimiter'

/**
 * POST /api/guest/init
 * Idempotent session initialisation:
 *   1. Valid session cookie  → return authenticated user (isGuest: false), count: 0
 *   2. Valid guestId cookie  → return guest user, count: N
 *   3. Neither              → create guest, set guestId cookie, return guest, count: 0
 */
async function postHandler(req: NextRequest) {
  // 1. Real authenticated user
  const sessionUserId = getUserFromRequest(req)
  if (sessionUserId) {
    const user = await authService.me(sessionUserId)
    if (user) {
      return NextResponse.json({ user, guestComparisonCount: 0 })
    }
  }

  // 2. Existing guest session
  const guestUserId = getGuestFromRequest(req)
  if (guestUserId) {
    const user = await authService.getGuestById(guestUserId)
    if (user) {
      const guestComparisonCount = await historyService.countByUser(guestUserId)
      return NextResponse.json({ user, guestComparisonCount })
    }
  }

  // 3. No session — create a new guest
  const guest = await authService.createGuest()
  const token = signGuestToken(guest.id)
  const res = NextResponse.json({ user: guest, guestComparisonCount: 0 })
  setGuestCookie(res, token)
  return res
}

export const POST = withRateLimit(postHandler, 'lenient', 'guest:init')
