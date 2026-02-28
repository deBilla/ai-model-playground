import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/modules/auth'

/**
 * GET /api/cron/cleanup-guests
 * Deletes expired guest user accounts and their associated comparisons.
 * Protected by Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization')
  const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (provided !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const deleted = await authService.deleteExpiredGuests()
  return NextResponse.json({ deleted })
}
