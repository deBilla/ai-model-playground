import { NextRequest, NextResponse } from 'next/server'
import { historyService } from '@/lib/modules/history'
import { getUserFromRequest, getGuestFromRequest, unauthorized } from '@/lib/auth'
import { withRateLimit } from '@/lib/rateLimiter'

const err = (msg: string, status: number) => NextResponse.json({ error: msg }, { status })

type Context = { params: { id: string } }

async function getHandler(req: NextRequest, context?: Context) {
  const userId = getUserFromRequest(req) ?? getGuestFromRequest(req)
  if (!userId || !context) return unauthorized()
  try {
    const record = await historyService.getOne(userId, context.params.id)
    return record ? NextResponse.json(record) : err('Not found', 404)
  } catch { return err('Failed to fetch comparison', 500) }
}

async function deleteHandler(req: NextRequest, context?: Context) {
  const userId = getUserFromRequest(req) ?? getGuestFromRequest(req)
  if (!userId || !context) return unauthorized()
  try {
    const deleted = await historyService.delete(userId, context.params.id)
    return deleted ? NextResponse.json({ ok: true }) : err('Not found', 404)
  } catch { return err('Failed to delete comparison', 500) }
}

export const GET = withRateLimit(getHandler, 'lenient', 'comparisons:id:get')
export const DELETE = withRateLimit(deleteHandler, 'moderate', 'comparisons:id:delete')
