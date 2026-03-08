import type { NextRequest } from 'next/server'
import type { ZodType } from 'zod'
import { getUserFromRequest, getGuestFromRequest, unauthorized } from '@/lib/auth'
import { historyService } from '@/lib/modules/history'
import { NextResponse } from 'next/server'

export interface AuthContext {
  userId: string
  guestUserId: string | null
  isGuest: boolean
}

type AuthedHandler<P = void> = (req: NextRequest, ctx: AuthContext, params?: P) => Promise<Response>
type RouteHandler<P = void> = (req: NextRequest, params?: P) => Promise<Response>
type JsonBodyHandler<T, P = void> = (req: NextRequest, data: T, params?: P) => Promise<Response>

/**
 * Resolves session/guest identity and injects AuthContext.
 * Returns 401 if neither cookie is present.
 */
export function withAuth<P = void>(handler: AuthedHandler<P>): RouteHandler<P> {
  return async (req, params) => {
    const sessionUserId = getUserFromRequest(req)
    const guestUserId = sessionUserId ? null : getGuestFromRequest(req)
    const userId = sessionUserId ?? guestUserId
    if (!userId) return unauthorized()
    return handler(req, { userId, guestUserId, isGuest: !!guestUserId }, params)
  }
}

/**
 * Parses the JSON request body and validates it against a Zod schema.
 * Returns 400 for unparseable JSON, 422 for schema validation failures.
 */
export function withJsonBody<T, P = void>(schema: ZodType<T>, handler: JsonBodyHandler<T, P>): RouteHandler<P> {
  return async (req, params) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
    }
    return handler(req, parsed.data, params)
  }
}

/**
 * Like withAuth but restricts to real session users only — guests are rejected with 401.
 * Use this for endpoints that must not be accessible to guest accounts.
 */
export function withSessionAuth<P = void>(handler: (req: NextRequest, ctx: Omit<AuthContext, 'guestUserId' | 'isGuest'>, params?: P) => Promise<Response>): RouteHandler<P> {
  return async (req, params) => {
    const userId = getUserFromRequest(req)
    if (!userId) return unauthorized()
    return handler(req, { userId }, params)
  }
}

/**
 * Checks the guest comparison limit before running the handler.
 * Must be composed inside withAuth so AuthContext is available.
 * Returns 403 with { limitReached: true } when the limit is exceeded.
 */
export function withGuestLimit<P = void>(handler: AuthedHandler<P>): AuthedHandler<P> {
  return async (req, ctx, params) => {
    if (ctx.guestUserId && await historyService.hasReachedGuestLimit(ctx.guestUserId)) {
      return NextResponse.json(
        { error: 'Comparison limit reached. Sign up to save unlimited comparisons.', limitReached: true },
        { status: 403 },
      )
    }
    return handler(req, ctx, params)
  }
}
