import { getModel } from './models.config'
import type { ProviderId } from './models.config'
import { ModelResult, PanelState } from './types'

/**
 * Custom NDJSON streaming protocol used by /api/chats.
 * Each newline-delimited JSON line has a `t` discriminant:
 *   { t: 'text',  provider, v: string }   — streaming text chunk
 *   { t: 'meta',  provider, promptTokens, completionTokens, totalTokens,
 *                 latencyMs, estimatedCost, timeToFirstToken, tokensPerSecond, responseLength }
 *   { t: 'error', provider, v: string, isRateLimit?: boolean }
 */
type StreamLine =
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

function parseLine(line: string): StreamLine | null {
  if (!line.trim()) return null
  try {
    return JSON.parse(line) as StreamLine
  } catch {
    return null
  }
}

// One AbortController per provider — cancels any in-flight request when a
// new comparison starts, preventing stale chunks from polluting new panels.
const activeControllers = new Map<ProviderId, AbortController>()

/** Abort all in-flight provider streams (used by the Stop button). */
export function abortAllProviders(): void {
  activeControllers.forEach((c) => c.abort())
  activeControllers.clear()
}

export async function streamProvider(
  provider: ProviderId,
  prompt: string,
  setPanelState: (provider: ProviderId, state: Partial<PanelState>) => void,
  settings?: { temperature: number; maxTokens: number },
): Promise<ModelResult | null> {
  // Cancel previous in-flight request for this provider, if any
  activeControllers.get(provider)?.abort()
  const controller = new AbortController()
  activeControllers.set(provider, controller)

  setPanelState(provider, {
    status: 'loading',
    streamedText: '',
    error: undefined,
    metrics: undefined,
    isRateLimit: false,
  })

  try {
    const response = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, provider, ...settings }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `HTTP ${response.status}`)
    }

    if (!response.body) throw new Error('No response body')

    setPanelState(provider, { status: 'streaming' })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let streamedText = ''
    let metrics: PanelState['metrics'] | undefined

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const parsed = parseLine(line)
        if (!parsed) continue
        // Verify provider matches to prevent stale cross-contamination
        if (parsed.provider && parsed.provider !== provider) continue

        if (parsed.t === 'text') {
          streamedText += parsed.v
          setPanelState(provider, { streamedText })
        } else if (parsed.t === 'meta') {
          metrics = {
            promptTokens: parsed.promptTokens,
            completionTokens: parsed.completionTokens,
            totalTokens: parsed.totalTokens,
            latencyMs: parsed.latencyMs,
            estimatedCost: parsed.estimatedCost,
            timeToFirstToken: parsed.timeToFirstToken,
            tokensPerSecond: parsed.tokensPerSecond,
            responseLength: parsed.responseLength,
          }
        } else if (parsed.t === 'error') {
          throw Object.assign(new Error(parsed.v), { isRateLimit: parsed.isRateLimit ?? false })
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      const parsed = parseLine(buffer)
      if (parsed && parsed.provider === provider) {
        if (parsed.t === 'text') streamedText += parsed.v
        else if (parsed.t === 'meta') {
          metrics = {
            promptTokens: parsed.promptTokens,
            completionTokens: parsed.completionTokens,
            totalTokens: parsed.totalTokens,
            latencyMs: parsed.latencyMs,
            estimatedCost: parsed.estimatedCost,
            timeToFirstToken: parsed.timeToFirstToken,
            tokensPerSecond: parsed.tokensPerSecond,
            responseLength: parsed.responseLength,
          }
        } else if (parsed.t === 'error') {
          throw Object.assign(new Error(parsed.v), { isRateLimit: parsed.isRateLimit ?? false })
        }
      }
    }

    setPanelState(provider, { status: 'done', metrics })

    const model = getModel(provider)
    return {
      provider,
      label: model?.label ?? provider,
      responseText: streamedText,
      promptTokens: metrics?.promptTokens ?? 0,
      completionTokens: metrics?.completionTokens ?? 0,
      totalTokens: metrics?.totalTokens ?? 0,
      latencyMs: metrics?.latencyMs ?? 0,
      estimatedCost: metrics?.estimatedCost ?? 0,
      timeToFirstToken: metrics?.timeToFirstToken ?? 0,
      tokensPerSecond: metrics?.tokensPerSecond ?? 0,
      responseLength: metrics?.responseLength ?? 0,
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return null
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    const isRateLimit = (err as { isRateLimit?: boolean }).isRateLimit ?? false
    setPanelState(provider, { status: 'error', error: errorMsg, isRateLimit })
    return null
  } finally {
    if (activeControllers.get(provider) === controller) {
      activeControllers.delete(provider)
    }
  }
}
