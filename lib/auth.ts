import jwt from 'jsonwebtoken'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
const COOKIE_NAME = 'session'
const GUEST_COOKIE_NAME = 'guestId'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

interface JwtPayload {
  sub: string
  isGuest?: boolean
  iat?: number
  exp?: number
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' })
}

export function signGuestToken(userId: string): string {
  return jwt.sign({ sub: userId, isGuest: true }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}

export function getUserFromRequest(request: NextRequest): string | null {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload?.sub || payload.isGuest) return null
  return payload.sub
}

export function getGuestFromRequest(request: NextRequest): string | null {
  const token = request.cookies.get(GUEST_COOKIE_NAME)?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload?.sub || !payload.isGuest) return null
  return payload.sub
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}

export function setGuestCookie(response: NextResponse, token: string): void {
  response.cookies.set(GUEST_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export function clearGuestCookie(response: NextResponse): void {
  response.cookies.set(GUEST_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
