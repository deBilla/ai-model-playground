import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getGuestFromRequest } from './auth'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (req: NextRequest) => string | null
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

setInterval(() => {
  const now = Date.now()
  Array.from(rateLimitStore.entries()).forEach(([key, entry]) => {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  })
}, 60000)

export const rateLimitTiers = {
  strict: { windowMs: 60_000, maxRequests: 5 },
  moderate: { windowMs: 60_000, maxRequests: 20 },
  lenient: { windowMs: 60_000, maxRequests: 60 },
  guestModerate: { windowMs: 60_000, maxRequests: 10 },
  guestLenient: { windowMs: 60_000, maxRequests: 30 },
} as const

type TierName = keyof typeof rateLimitTiers

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return 'unknown'
}

function generateKey(req: NextRequest, prefix: string): string {
  const userId = getUserFromRequest(req)
  if (userId) return `${prefix}:user:${userId}`

  const guestId = getGuestFromRequest(req)
  if (guestId) return `${prefix}:guest:${guestId}`

  const ip = getClientIp(req)
  return `${prefix}:ip:${ip}`
}

export function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetTime: number; retryAfter: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs })
    return { allowed: true, remaining: config.maxRequests - 1, resetTime: now + config.windowMs, retryAfter: 0 }
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime, retryAfter: Math.ceil((entry.resetTime - now) / 1000) }
  }

  entry.count++
  return { allowed: true, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime, retryAfter: 0 }
}

type RouteHandler<T = unknown> = (req: NextRequest, context?: T) => Promise<Response>

function getTierForRequest(req: NextRequest, tier: TierName): RateLimitConfig {
  const userId = getUserFromRequest(req)
  const guestId = getGuestFromRequest(req)
  const isGuest = !userId && !!guestId

  if (isGuest) {
    if (tier === 'moderate') return rateLimitTiers.guestModerate
    if (tier === 'lenient') return rateLimitTiers.guestLenient
  }

  return rateLimitTiers[tier]
}

export function withRateLimit<T = unknown>(handler: RouteHandler<T>, tier: TierName, keyPrefix?: string): RouteHandler<T> {
  return async (req: NextRequest, context?: T) => {
    const prefix = keyPrefix || `rl:${tier}`
    const config = getTierForRequest(req, tier)
    const key = generateKey(req, prefix)
    const result = checkRateLimit(key, config)

    const headers = new Headers()
    headers.set('X-RateLimit-Limit', String(config.maxRequests))
    headers.set('X-RateLimit-Remaining', String(result.remaining))
    headers.set('X-RateLimit-Reset', String(Math.floor(result.resetTime / 1000)))

    if (!result.allowed) {
      headers.set('Retry-After', String(result.retryAfter))
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.', retryAfter: result.retryAfter }),
        { status: 429, headers: { 'Content-Type': 'application/json', ...Object.fromEntries(headers) } }
      )
    }

    const response = await handler(req, context)

    Array.from(headers.entries()).forEach(([h, v]) => {
      response.headers.set(h, v)
    })

    return response
  }
}
