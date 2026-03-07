import { NextResponse } from 'next/server'
import { authService } from '@/lib/modules/auth'
import { signGuestToken, setGuestCookie } from '@/lib/auth'

/**
 * POST /api/guests
 * Creates a new guest user and sets the guestId cookie.
 * Only called for brand-new visitors with no existing session.
 */
export async function POST() {
  const guest = await authService.createGuest()
  const token = signGuestToken(guest.id)
  const res = NextResponse.json({ user: guest, guestComparisonCount: 0 }, { status: 201 })
  setGuestCookie(res, token)
  return res
}
