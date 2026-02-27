import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/modules/auth'
import { RegisterRequestSchema } from '@/lib/modules/auth/auth.dto'
import { signToken, setSessionCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = RegisterRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  try {
    const user = await authService.register(parsed.data)
    const token = signToken(user.id)
    const res = NextResponse.json({ user }, { status: 201 })
    setSessionCookie(res, token)
    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
