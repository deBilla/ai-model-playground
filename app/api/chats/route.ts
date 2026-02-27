import { NextRequest } from 'next/server'
import { chatService } from '@/lib/modules/chat'
import { ChatRequestSchema } from '@/lib/modules/chat/chat.dto'
import { buildNdjsonStream } from '@/lib/modules/chat/buildNdjsonStream'
import { getUserFromRequest, unauthorized } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/chats
 * Streams one provider response via NDJSON protocol.
 * Each line: { t: 'text'|'meta'|'error', provider, ...fields }
 */
export async function POST(req: NextRequest) {
  const userId = getUserFromRequest(req)
  if (!userId) return unauthorized()

  let body: unknown
  try { body = await req.json() } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const parsed = ChatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), { status: 422 })
  }

  const stream = buildNdjsonStream(chatService.stream(parsed.data), Date.now(), parsed.data.provider)
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
