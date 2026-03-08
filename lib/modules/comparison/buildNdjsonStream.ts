import type { LanguageModelUsage } from 'ai'
import { enqueueJson, classifyStreamError } from './ndjsonCodec'

type StreamResult = {
  textStream: AsyncIterable<string>
  usage: PromiseLike<LanguageModelUsage>
  costFor: (promptTokens: number, completionTokens: number) => number
}

export function buildNdjsonStream(result: StreamResult, startTime: number, provider: string): ReadableStream {
  const { textStream, usage, costFor } = result
  return new ReadableStream({
    async start(controller) {
      let timeToFirstToken = 0
      let responseLength = 0
      let firstChunk = true

      try {
        for await (const chunk of textStream) {
          if (firstChunk) {
            timeToFirstToken = Date.now() - startTime
            firstChunk = false
          }
          responseLength += chunk.length
          enqueueJson(controller, { t: 'text', provider, v: chunk })
        }

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
      } catch (err) {
        const { isRateLimit, message } = classifyStreamError(err)
        enqueueJson(controller, { t: 'error', provider, v: message, isRateLimit })
      } finally {
        controller.close()
      }
    },
  })
}
