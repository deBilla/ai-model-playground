/**
 * Single authoritative definition of the NDJSON streaming protocol used by
 * /api/comparisons (multiplexed multi-provider stream).
 *
 * Each newline-delimited line is one of three discriminated shapes:
 *   { t: 'text',  provider, v: string }
 *   { t: 'meta',  provider, promptTokens, completionTokens, totalTokens,
 *                 latencyMs, estimatedCost, timeToFirstToken, tokensPerSecond, responseLength }
 *   { t: 'error', provider, v: string, isRateLimit?: boolean }
 */

// ─── Protocol type ────────────────────────────────────────────────────────────

export type StreamLine =
  | { t: 'text'; provider: string; v: string }
  | {
      t: 'meta'
      provider: string
      promptTokens: number
      completionTokens: number
      totalTokens: number
      latencyMs: number
      estimatedCost: number
      timeToFirstToken: number
      tokensPerSecond: number
      responseLength: number
    }
  | { t: 'error'; provider: string; v: string; isRateLimit?: boolean }
  | { t: 'saved'; comparisonId: string; shareToken: string | null }

// ─── Consumer: parse a single NDJSON line ────────────────────────────────────

export function parseLine(line: string): StreamLine | null {
  if (!line.trim()) return null
  try {
    return JSON.parse(line) as StreamLine
  } catch {
    return null
  }
}

// ─── Producer: encode and enqueue a frame ────────────────────────────────────

const encoder = new TextEncoder()

export function enqueueJson(
  controller: ReadableStreamDefaultController,
  obj: Record<string, unknown>,
): void {
  controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
}

// ─── Producer: classify a stream error ───────────────────────────────────────

export function classifyStreamError(err: unknown): { isRateLimit: boolean; message: string } {
  const error = err as { status?: number; message?: string } | null
  const isRateLimit =
    error?.status === 429 ||
    !!error?.message?.toLowerCase().includes('rate limit') ||
    !!error?.message?.toLowerCase().includes('too many requests')
  return {
    isRateLimit,
    message: isRateLimit
      ? 'Rate limit exceeded. Please wait a moment and try again.'
      : err instanceof Error
        ? err.message
        : 'Stream error',
  }
}
