import { NextRequest, NextResponse } from 'next/server'
import { historyService } from '@/lib/modules/history'
import { getUserFromRequest, getGuestFromRequest, unauthorized } from '@/lib/auth'

const err = (msg: string, status: number) => NextResponse.json({ error: msg }, { status })

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserFromRequest(req) ?? getGuestFromRequest(req)
  if (!userId) return unauthorized()
  try {
    const record = await historyService.getOne(userId, params.id)
    return record ? NextResponse.json(record) : err('Not found', 404)
  } catch { return err('Failed to fetch comparison', 500) }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserFromRequest(req) ?? getGuestFromRequest(req)
  if (!userId) return unauthorized()
  try {
    const deleted = await historyService.delete(userId, params.id)
    return deleted ? NextResponse.json({ ok: true }) : err('Not found', 404)
  } catch { return err('Failed to delete comparison', 500) }
}
