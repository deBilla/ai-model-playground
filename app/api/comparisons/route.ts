import { NextResponse } from 'next/server'
import { comparisonService } from '@/lib/modules/comparison'
import { CompareRequestSchema } from '@/lib/modules/comparison/compare.dto'
import { buildMultiplexedStream, type CompletedProviderResponse } from '@/lib/modules/comparison/buildMultiplexedStream'
import { getModel, type ProviderId } from '@/lib/models.config'
import { historyService } from '@/lib/modules/history'
import { ListComparisonsSchema } from '@/lib/modules/history/history.dto'
import { withAuth, withGuestLimit } from '@/lib/route-guards'

export const runtime = 'nodejs'
export const maxDuration = 60

const err = (msg: string, status: number) => NextResponse.json({ error: msg }, { status })

export const GET = withAuth(async (req, { userId, isGuest }) => {
  const { searchParams } = new URL(req.url)
  const p = ListComparisonsSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  })
  const { page, limit } = p.success ? p.data : { page: 1, limit: 20 }
  try {
    return NextResponse.json(await historyService.findAll(userId, page, limit, isGuest))
  } catch { return err('Failed to fetch comparisons', 500) }
})

/**
 * POST /api/comparisons
 * Fans out to all configured models concurrently and streams their interleaved
 * NDJSON responses over a single connection.
 * Each line: { t: 'text'|'meta'|'error'|'saved', provider?, ...fields }
 */
export const POST = withAuth(withGuestLimit(async (req, { userId, guestUserId }) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const parsed = CompareRequestSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), { status: 422 })
  }

  const { prompt, temperature, maxTokens } = parsed.data

  const providerStreams = comparisonService.fanOut({ prompt, temperature, maxTokens })

  const onAllComplete = async (responses: CompletedProviderResponse[]) => {
    const record = await historyService.saveComparison(userId, !!guestUserId, {
      prompt,
      responses: responses.map((r) => ({
        ...r,
        provider: r.provider as ProviderId,
        label: getModel(r.provider as ProviderId)?.label ?? r.provider,
      })),
    })
    return { comparisonId: record.id, shareToken: record.shareToken ?? null }
  }

  return new Response(buildMultiplexedStream(providerStreams, req.signal, onAllComplete), {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}))
