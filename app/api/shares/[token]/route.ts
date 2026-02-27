import { NextRequest, NextResponse } from 'next/server'
import { historyService } from '@/lib/modules/history'

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const record = await historyService.getByShareToken(params.token)
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(record)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch share' }, { status: 500 })
  }
}
