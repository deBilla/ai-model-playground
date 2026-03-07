import { NextRequest, NextResponse } from 'next/server'
import { chatService } from '@/lib/modules/chat'
import { CompareRequestSchema } from '@/lib/modules/chat/compare.dto'
import { buildMultiplexedStream, type CompletedProviderResponse } from '@/lib/modules/chat/buildMultiplexedStream'
import { getUserFromRequest, getGuestFromRequest, unauthorized } from '@/lib/auth'
import { MODELS, getModel } from '@/lib/models.config'
import type { ProviderId } from '@/lib/models.config'
import { historyService } from '@/lib/modules/history'
import { ListComparisonsSchema } from '@/lib/modules/history/history.dto'

export const runtime = 'nodejs'
export const maxDuration = 60

const err = (msg: string, status: number) => NextResponse.json({ error: msg }, { status })

export async function GET(req: NextRequest) {
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
    return NextResponse.json(await historyService.findAll(userId, page, limit, !!guestUserId))
  } catch { return err('Failed to fetch comparisons', 500) }
}

/**
 * POST /api/comparisons
 * Fans out to all configured models concurrently and streams their interleaved
 * NDJSON responses over a single connection.
 * Each line: { t: 'text'|'meta'|'error'|'saved', provider?, ...fields }
 */
export async function POST(req: NextRequest) {
  const sessionUserId = getUserFromRequest(req)
  const guestUserId = sessionUserId ? null : getGuestFromRequest(req)
  const userId = sessionUserId ?? guestUserId
  if (!userId) return unauthorized()

  // Fail fast: check guest limit before starting expensive model streams
  if (guestUserId && await historyService.hasReachedGuestLimit(guestUserId)) {
    return new Response(
      JSON.stringify({ error: 'Comparison limit reached. Sign up to save unlimited comparisons.', limitReached: true }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

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

  const providerStreams = MODELS.map((model) => ({
    ...chatService.stream({ prompt, provider: model.id as ProviderId, temperature, maxTokens }),
    provider: model.id,
    startTime: Date.now(),
  }))

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
}
