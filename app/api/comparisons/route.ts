import { NextRequest, NextResponse } from 'next/server'
import { historyService } from '@/lib/modules/history'
import { CreateComparisonSchema, ListComparisonsSchema } from '@/lib/modules/history/history.dto'
import { getUserFromRequest, unauthorized } from '@/lib/auth'

const err = (msg: string, status: number) => NextResponse.json({ error: msg }, { status })

export async function GET(req: NextRequest) {
  const userId = getUserFromRequest(req)
  if (!userId) return unauthorized()
  const { searchParams } = new URL(req.url)
  const p = ListComparisonsSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  })
  const { page, limit } = p.success ? p.data : { page: 1, limit: 20 }
  try {
    return NextResponse.json(await historyService.findAll(userId, page, limit))
  } catch { return err('Failed to fetch comparisons', 500) }
}

export async function POST(req: NextRequest) {
  const userId = getUserFromRequest(req)
  if (!userId) return unauthorized()
  let body: unknown
  try { body = await req.json() } catch { return err('Invalid JSON', 400) }
  const parsed = CreateComparisonSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  try {
    return NextResponse.json(await historyService.create(userId, parsed.data), { status: 201 })
  } catch { return err('Failed to save comparison', 500) }
}
