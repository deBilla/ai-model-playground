import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/modules/auth'
import { LoginRequestSchema } from '@/lib/modules/auth/auth.dto'
import { signToken, setSessionCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = LoginRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  try {
    const { userId, user } = await authService.login(parsed.data)
    const token = signToken(userId)
    const res = NextResponse.json({ user })
    setSessionCookie(res, token)
    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
