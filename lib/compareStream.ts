import { getModel, MODELS } from './models.config'
import type { ProviderId } from './models.config'
import type { ModelResult, ComparisonRecord, PanelState } from './types'
import { type StreamLine, parseLine } from '@/lib/modules/comparison/ndjsonCodec'

type LineCtx = { streamedText: string; metrics: PanelState['metrics'] | undefined }

export type StreamConsumeResult = {
  results: ModelResult[]
  savedRecord: ComparisonRecord | null
  limitReached: boolean
}

// Single AbortController for the one in-flight compare request.
let activeController: AbortController | null = null

/** Abort the in-flight compare stream (used by the Stop button). */
export function abortCompareStream(): void {
  activeController?.abort()
  activeController = null
}

/**
 * Connects to POST /api/comparisons, reads the multiplexed NDJSON stream,
 * routes each frame to the correct panel via setPanelState, and returns
 * results, the saved comparison record (if persisted), and a limitReached flag.
 */
export async function consumeMultiplexedStream(
  prompt: string,
  setPanelState: (provider: ProviderId, state: Partial<PanelState>) => void,
  settings?: { temperature: number; maxTokens: number },
): Promise<StreamConsumeResult> {
  // Abort any previous in-flight stream
  activeController?.abort()
  const controller = new AbortController()
  activeController = controller

  // Mark all panels as loading before the fetch starts
  for (const model of MODELS) {
    setPanelState(model.id as ProviderId, {
      status: 'loading',
      streamedText: '',
      error: undefined,
      metrics: undefined,
      isRateLimit: false,
    })
  }

  const results: ModelResult[] = []
  const ctxMap = new Map<string, LineCtx>()
  let savedRecord: ComparisonRecord | null = null

  try {
    const response = await fetch('/api/comparisons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, ...settings }),
      signal: controller.signal,
    })

    if (response.status === 403) {
      const data = await response.json().catch(() => ({}))
      const limitReached = !!(data as { limitReached?: boolean }).limitReached
      return { results: [], savedRecord: null, limitReached }
    }

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `HTTP ${response.status}`)
    }

    if (!response.body) throw new Error('No response body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const parsed = parseLine(line)
        if (!parsed) continue
        if (parsed.t === 'saved') {
          savedRecord = { id: parsed.comparisonId, prompt, createdAt: new Date().toISOString(), shareToken: parsed.shareToken, responses: results }
        } else {
          applyFrame(parsed, ctxMap, setPanelState, results)
        }
      }
    }

    // Flush any remaining buffer content
    if (buffer.trim()) {
      const parsed = parseLine(buffer)
      if (parsed) {
        if (parsed.t === 'saved') {
          savedRecord = { id: parsed.comparisonId, prompt, createdAt: new Date().toISOString(), shareToken: parsed.shareToken, responses: results }
        } else {
          applyFrame(parsed, ctxMap, setPanelState, results)
        }
      }
    }

    // Unconditionally mark any panel that received text but whose meta frame was
    // not processed (e.g. stream closed before meta arrived) as done.
    ctxMap.forEach((ctx, provId) => {
      if (!ctx.metrics) {
        setPanelState(provId as ProviderId, { status: 'done' })
      }
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return { results, savedRecord, limitReached: false }
    // Mark panels as errored (no frames received) or done (had text, no meta)
    for (const model of MODELS) {
      const ctx = ctxMap.get(model.id)
      if (!ctx) {
        setPanelState(model.id as ProviderId, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      } else if (!ctx.metrics) {
        setPanelState(model.id as ProviderId, { status: 'done' })
      }
    }
    console.error('[consumeMultiplexedStream]', err)
  } finally {
    if (activeController === controller) activeController = null
  }

  return { results, savedRecord, limitReached: false }
}

function applyFrame(
  parsed: Exclude<StreamLine, { t: 'saved' }>,
  ctxMap: Map<string, LineCtx>,
  setPanelState: (provider: ProviderId, state: Partial<PanelState>) => void,
  results: ModelResult[],
): void {
  const provider = parsed.provider as ProviderId

  if (!ctxMap.has(provider)) {
    ctxMap.set(provider, { streamedText: '', metrics: undefined })
    setPanelState(provider, { status: 'streaming', streamedText: '', error: undefined, metrics: undefined, isRateLimit: false })
  }

  const ctx = ctxMap.get(provider)!

  if (parsed.t === 'text') {
    ctx.streamedText += parsed.v
    setPanelState(provider, { streamedText: ctx.streamedText })
  } else if (parsed.t === 'meta') {
    // Build metrics once; reuse for both the panel update and the result record.
    const { t: _t, provider: _p, ...metrics } = parsed
    ctx.metrics = metrics
    setPanelState(provider, { status: 'done', metrics })
    const model = getModel(provider)
    results.push({
      provider,
      label: model?.label ?? provider,
      responseText: ctx.streamedText,
      ...metrics,
    })
  } else if (parsed.t === 'error') {
    setPanelState(provider, {
      status: 'error',
      error: parsed.v,
      isRateLimit: parsed.isRateLimit ?? false,
    })
  }
}
