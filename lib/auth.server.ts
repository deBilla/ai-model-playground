import { cookies } from 'next/headers'
import { verifyToken } from './auth'

export function getSessionUserIdFromCookies(): string | null {
  const token = cookies().get('session')?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload?.sub || payload.isGuest) return null
  return payload.sub
}

export function getGuestUserIdFromCookies(): string | null {
  const token = cookies().get('guestId')?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload?.sub || !payload.isGuest) return null
  return payload.sub
}
