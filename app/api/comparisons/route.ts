import { NextRequest, NextResponse } from 'next/server'
import { historyService } from '@/lib/modules/history'
import { CreateComparisonSchema, ListComparisonsSchema } from '@/lib/modules/history/history.dto'
import { getUserFromRequest, getGuestFromRequest, unauthorized } from '@/lib/auth'
import { GUEST_COMPARISON_LIMIT } from '@/lib/constants'
import { withRateLimit } from '@/lib/rateLimiter'
import type { ComparisonRecord } from '@/lib/types'

const err = (msg: string, status: number) => NextResponse.json({ error: msg }, { status })

function stripShareToken(record: ComparisonRecord): ComparisonRecord {
  return { ...record, shareToken: null }
}

async function getHandler(req: NextRequest) {
  const sessionUserId = getUserFromRequest(req)
  const guestUserId = sessionUserId ? null : getGuestFromRequest(req)
  const userId = sessionUserId ?? guestUserId
  if (!userId) return unauthorized()

  const { searchParams } = new URL(req.url)
  const p = ListComparisonsSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  })
  const { page, limit } = p.success ? p.data : { page: 1, limit: 20 }
  try {
    const result = await historyService.findAll(userId, page, limit)
    if (guestUserId) {
      result.data = result.data.map(stripShareToken)
    }
    return NextResponse.json(result)
  } catch { return err('Failed to fetch comparisons', 500) }
}

async function postHandler(req: NextRequest) {
  const sessionUserId = getUserFromRequest(req)
  const guestUserId = sessionUserId ? null : getGuestFromRequest(req)
  const userId = sessionUserId ?? guestUserId
  if (!userId) return unauthorized()

  // Enforce comparison limit for guest users
  if (guestUserId) {
    const count = await historyService.countByUser(guestUserId)
    if (count >= GUEST_COMPARISON_LIMIT) {
      return NextResponse.json(
        { error: 'Comparison limit reached. Sign up to save unlimited comparisons.', limitReached: true },
        { status: 403 },
      )
    }
  }

  let body: unknown
  try { body = await req.json() } catch { return err('Invalid JSON', 400) }
  const parsed = CreateComparisonSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  try {
    const record = await historyService.create(userId, parsed.data)
    const response = guestUserId ? stripShareToken(record) : record
    return NextResponse.json(response, { status: 201 })
  } catch { return err('Failed to save comparison', 500) }
}

export const GET = withRateLimit(getHandler, 'lenient', 'comparisons:get')
export const POST = withRateLimit(postHandler, 'moderate', 'comparisons:post')
