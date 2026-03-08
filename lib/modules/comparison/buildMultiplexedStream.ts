import type { LanguageModelUsage } from 'ai'
import { enqueueJson, classifyStreamError } from './ndjsonCodec'

type ProviderStream = {
  textStream: AsyncIterable<string>
  usage: PromiseLike<LanguageModelUsage>
  costFor: (promptTokens: number, completionTokens: number) => number
  provider: string
  startTime: number
}

export type CompletedProviderResponse = {
  provider: string
  responseText: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
  latencyMs: number
  timeToFirstToken: number
  tokensPerSecond: number
  responseLength: number
}

export function buildMultiplexedStream(
  streams: ProviderStream[],
  signal?: AbortSignal,
  onAllComplete?: (responses: CompletedProviderResponse[]) => Promise<{ comparisonId: string; shareToken: string | null } | null>,
): ReadableStream<Uint8Array> {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  let activePending = streams.length
  const completed: CompletedProviderResponse[] = []

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl
    },
  })

  const finalize = async () => {
    if (onAllComplete && completed.length > 0) {
      try {
        const result = await onAllComplete(completed)
        // Only enqueue the saved frame if the client is still connected
        if (result && !signal?.aborted) {
          enqueueJson(controller, { t: 'saved', comparisonId: result.comparisonId, shareToken: result.shareToken })
        }
      } catch {
        // save failed — stream still closes cleanly
      }
    }
    controller.close()
  }

  const drain = async (ps: ProviderStream) => {
    const { textStream, usage, costFor, provider, startTime } = ps
    let timeToFirstToken = 0
    let responseLength = 0
    let responseText = ''
    let firstChunk = true

    try {
      for await (const chunk of textStream) {
        if (signal?.aborted) return
        if (firstChunk) {
          timeToFirstToken = Date.now() - startTime
          firstChunk = false
        }
        responseText += chunk
        responseLength += chunk.length
        enqueueJson(controller, { t: 'text', provider, v: chunk })
      }

      if (signal?.aborted) return

      const { inputTokens, outputTokens } = await usage
      const promptTokens = inputTokens ?? 0
      const completionTokens = outputTokens ?? 0
      const latencyMs = Date.now() - startTime
      const tokensPerSecond = latencyMs > 0 ? completionTokens / (latencyMs / 1000) : 0

      enqueueJson(controller, {
        t: 'meta',
        provider,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        latencyMs,
        estimatedCost: costFor(promptTokens, completionTokens),
        timeToFirstToken,
        tokensPerSecond,
        responseLength,
      })

      completed.push({ provider, responseText, promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, estimatedCost: costFor(promptTokens, completionTokens), latencyMs, timeToFirstToken, tokensPerSecond, responseLength })
    } catch (err) {
      if (signal?.aborted) return
      const { isRateLimit, message } = classifyStreamError(err)
      enqueueJson(controller, { t: 'error', provider, v: message, isRateLimit })
    } finally {
      activePending--
      if (activePending === 0) await finalize()
    }
  }

  // Fire all provider drains concurrently. Individual errors are caught per-provider above.
  Promise.all(streams.map(drain)).catch(() => {
    if (activePending > 0) controller.close()
  })

  return stream
}
