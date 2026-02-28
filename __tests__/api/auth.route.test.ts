// @vitest-environment node
/**
 * Integration tests for the auth API routes.
 * Route handlers are called directly (no HTTP server). Services are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/modules/auth', () => ({
  authService: {
    register: vi.fn(),
    login: vi.fn(),
    me: vi.fn(),
  },
}))

import { POST as registerPOST } from '@/app/api/auth/register/route'
import { POST as loginPOST } from '@/app/api/auth/login/route'
import { POST as logoutPOST } from '@/app/api/auth/logout/route'
import { GET as meGET } from '@/app/api/auth/me/route'
import { authService } from '@/lib/modules/auth'
import { signToken } from '@/lib/auth'

const NOW_ISO = '2025-01-15T10:00:00.000Z'
const MOCK_USER = { id: 'user-1', email: 'test@example.com', name: 'Test User', isGuest: false, createdAt: NOW_ISO }

// Build an authenticated session cookie using a real JWT so getUserFromRequest works
function authCookie(userId = 'user-1') {
  return `session=${signToken(userId)}`
}

function jsonPost(url: string, body: unknown, cookie?: string): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

function getRequest(url: string, cookie?: string): NextRequest {
  return new NextRequest(url, {
    headers: cookie ? { Cookie: cookie } : {},
  })
}

beforeEach(() => { vi.clearAllMocks() })

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('returns 201 with the user and sets a session cookie on success', async () => {
    vi.mocked(authService.register).mockResolvedValue(MOCK_USER)

    const res = await registerPOST(jsonPost('http://localhost/api/auth/register', {
      email: 'test@example.com',
      password: 'secret123',
      name: 'Test User',
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.user).toMatchObject({ id: 'user-1', email: 'test@example.com' })
    expect(res.headers.get('Set-Cookie')).toContain('session=')
  })

  it('returns 422 for an invalid email', async () => {
    const res = await registerPOST(jsonPost('http://localhost/api/auth/register', {
      email: 'not-an-email',
      password: 'secret123',
    }))

    expect(res.status).toBe(422)
    expect(authService.register).not.toHaveBeenCalled()
  })

  it('returns 422 for a password shorter than 8 characters', async () => {
    const res = await registerPOST(jsonPost('http://localhost/api/auth/register', {
      email: 'test@example.com',
      password: 'short',
    }))

    expect(res.status).toBe(422)
  })

  it('returns 409 when the email is already in use', async () => {
    vi.mocked(authService.register).mockRejectedValue(new Error('Email already in use'))

    const res = await registerPOST(jsonPost('http://localhost/api/auth/register', {
      email: 'taken@example.com',
      password: 'secret123',
    }))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Email already in use')
  })

  it('returns 400 for malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json{{{',
    })

    const res = await registerPOST(req)
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('returns 200 with the user and sets a session cookie on success', async () => {
    vi.mocked(authService.login).mockResolvedValue({ userId: 'user-1', user: MOCK_USER })

    const res = await loginPOST(jsonPost('http://localhost/api/auth/login', {
      email: 'test@example.com',
      password: 'secret123',
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toMatchObject({ id: 'user-1' })
    expect(res.headers.get('Set-Cookie')).toContain('session=')
  })

  it('returns 401 on invalid credentials', async () => {
    vi.mocked(authService.login).mockRejectedValue(new Error('Invalid email or password'))

    const res = await loginPOST(jsonPost('http://localhost/api/auth/login', {
      email: 'test@example.com',
      password: 'wrongpassword',
    }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Invalid email or password')
  })

  it('returns 422 when the email field is missing', async () => {
    const res = await loginPOST(jsonPost('http://localhost/api/auth/login', {
      password: 'secret123',
    }))

    expect(res.status).toBe(422)
    expect(authService.login).not.toHaveBeenCalled()
  })

  it('returns 422 when the password field is empty', async () => {
    const res = await loginPOST(jsonPost('http://localhost/api/auth/login', {
      email: 'test@example.com',
      password: '',
    }))

    expect(res.status).toBe(422)
  })

  it('returns 400 for malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    })

    const res = await loginPOST(req)
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  it('returns 200 { ok: true }', async () => {
    const res = await logoutPOST()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('clears the session cookie (maxAge=0)', async () => {
    const res = await logoutPOST()

    const setCookie = res.headers.get('Set-Cookie') ?? ''
    expect(setCookie).toContain('session=')
    expect(setCookie).toContain('Max-Age=0')
  })

  it('does not require authentication', async () => {
    // Logout should work even without a cookie
    const res = await logoutPOST()
    expect(res.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('returns 200 with the user when authenticated', async () => {
    vi.mocked(authService.me).mockResolvedValue(MOCK_USER)

    const res = await meGET(getRequest('http://localhost/api/auth/me', authCookie()))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toMatchObject({ id: 'user-1', email: 'test@example.com' })
  })

  it('returns 401 when no session cookie is present', async () => {
    const res = await meGET(getRequest('http://localhost/api/auth/me'))

    expect(res.status).toBe(401)
    expect(authService.me).not.toHaveBeenCalled()
  })

  it('returns 401 when the cookie contains an invalid token', async () => {
    const req = new NextRequest('http://localhost/api/auth/me', {
      headers: { Cookie: 'session=invalid.jwt.token' },
    })

    const res = await meGET(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when the user no longer exists in the DB', async () => {
    vi.mocked(authService.me).mockResolvedValue(null)

    const res = await meGET(getRequest('http://localhost/api/auth/me', authCookie()))

    expect(res.status).toBe(401)
  })

  it('passes the userId decoded from the JWT to authService.me', async () => {
    vi.mocked(authService.me).mockResolvedValue(MOCK_USER)

    await meGET(getRequest('http://localhost/api/auth/me', authCookie('user-99')))

    expect(authService.me).toHaveBeenCalledWith('user-99')
  })
})
