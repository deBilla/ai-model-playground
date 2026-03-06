import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/auth', () => ({
  getUserFromRequest: vi.fn(),
  getGuestFromRequest: vi.fn(),
}))

import { checkRateLimit, rateLimitTiers, withRateLimit } from '@/lib/rateLimiter'
import { getUserFromRequest, getGuestFromRequest } from '@/lib/auth'

const mockGetUser = getUserFromRequest as ReturnType<typeof vi.fn>
const mockGetGuest = getGuestFromRequest as ReturnType<typeof vi.fn>

describe('checkRateLimit', () => {
  const config = { windowMs: 60_000, maxRequests: 5 }

  it('allows first request', () => {
    const result = checkRateLimit('test-key', config)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('tracks multiple requests', () => {
    checkRateLimit('multi-key', config)
    checkRateLimit('multi-key', config)
    const result = checkRateLimit('multi-key', config)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it('blocks when limit exceeded', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('limit-key', config)
    }
    const result = checkRateLimit('limit-key', config)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('resets after window expires', () => {
    const shortConfig = { windowMs: 100, maxRequests: 2 }
    checkRateLimit('expire-key', shortConfig)
    checkRateLimit('expire-key', shortConfig)
    
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = checkRateLimit('expire-key', shortConfig)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(1)
        resolve()
      }, 150)
    })
  })
})

describe('withRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockReturnValue(null)
    mockGetGuest.mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('passes through when under limit', async () => {
    mockGetUser.mockReturnValue('user-123')

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = withRateLimit(handler, 'moderate', 'test')

    const req = new NextRequest('http://localhost/api/test')
    const response = await wrapped(req)

    expect(response.status).toBe(200)
    expect(handler).toHaveBeenCalled()
    expect(response.headers.get('X-RateLimit-Limit')).toBe('20')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('19')
  })

  it('returns 429 when limit exceeded', async () => {
    mockGetUser.mockReturnValue('blocked-user-unique')

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = withRateLimit(handler, 'strict', 'blocked-test-unique')

    const req = new NextRequest('http://localhost/api/test')
    
    for (let i = 0; i < 5; i++) {
      await wrapped(req)
    }

    const response = await wrapped(req)
    expect(response.status).toBe(429)
    expect(handler).toHaveBeenCalledTimes(5)
    
    const body = await response.json()
    expect(body.error).toContain('Too many requests')
    expect(response.headers.get('Retry-After')).toBeTruthy()
  })

  it('applies guest limits for guest users', async () => {
    mockGetGuest.mockReturnValue('guest-123')

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = withRateLimit(handler, 'moderate', 'guest-limit-test')

    const req = new NextRequest('http://localhost/api/test')
    const response = await wrapped(req)

    expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
  })

  it('falls back to IP when no user/guest', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = withRateLimit(handler, 'lenient', 'ip-test')

    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '192.168.1.1' },
    })
    const response = await wrapped(req)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60')
  })
})

describe('rateLimitTiers', () => {
  it('defines correct limits', () => {
    expect(rateLimitTiers.strict.maxRequests).toBe(5)
    expect(rateLimitTiers.moderate.maxRequests).toBe(20)
    expect(rateLimitTiers.lenient.maxRequests).toBe(60)
    expect(rateLimitTiers.guestModerate.maxRequests).toBe(10)
    expect(rateLimitTiers.guestLenient.maxRequests).toBe(30)
  })
})
