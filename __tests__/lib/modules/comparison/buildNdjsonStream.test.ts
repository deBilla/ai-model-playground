import { describe, it, expect } from 'vitest'
import { buildNdjsonStream } from '@/lib/modules/comparison/buildNdjsonStream'

// Helper: drain a ReadableStream into parsed NDJSON frames
async function drainStream(stream: ReadableStream): Promise<Record<string, unknown>[]> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const frames: Record<string, unknown>[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
  }

  for (const line of buffer.split('\n')) {
    if (line.trim()) frames.push(JSON.parse(line))
  }
  return frames
}

// Helper: create an async iterable from an array of chunks
async function* makeTextStream(chunks: string[]): AsyncIterable<string> {
  for (const chunk of chunks) yield chunk
}

describe('buildNdjsonStream', () => {
  it('emits a text frame for each chunk', async () => {
    const stream = buildNdjsonStream(
      {
        textStream: makeTextStream(['Hello', ', ', 'world']),
        usage: Promise.resolve({ inputTokens: 5, outputTokens: 10 } as never),
        costFor: () => 0,
      },
      Date.now(),
      'openai',
    )

    const frames = await drainStream(stream)
    const textFrames = frames.filter((f) => f.t === 'text')
    expect(textFrames).toHaveLength(3)
    expect(textFrames[0]).toMatchObject({ t: 'text', provider: 'openai', v: 'Hello' })
    expect(textFrames[1]).toMatchObject({ t: 'text', provider: 'openai', v: ', ' })
    expect(textFrames[2]).toMatchObject({ t: 'text', provider: 'openai', v: 'world' })
  })

  it('emits a meta frame with correct token counts and responseLength', async () => {
    const stream = buildNdjsonStream(
      {
        textStream: makeTextStream(['Hello world']),
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 } as never),
        costFor: (p, c) => (p + c) * 0.001,
      },
      Date.now() - 200,
      'anthropic',
    )

    const frames = await drainStream(stream)
    const meta = frames.find((f) => f.t === 'meta')
    expect(meta).toBeDefined()
    expect(meta).toMatchObject({
      t: 'meta',
      provider: 'anthropic',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      responseLength: 11,   // 'Hello world'.length
      estimatedCost: 0.015, // (10+5)*0.001
    })
    // latencyMs >= 200ms (we gave startTime 200ms in the past)
    expect((meta!.latencyMs as number)).toBeGreaterThanOrEqual(200)
  })

  it('includes the provider field in every frame', async () => {
    const stream = buildNdjsonStream(
      {
        textStream: makeTextStream(['chunk']),
        usage: Promise.resolve({ inputTokens: 1, outputTokens: 1 } as never),
        costFor: () => 0,
      },
      Date.now(),
      'xai',
    )

    const frames = await drainStream(stream)
    expect(frames.length).toBeGreaterThanOrEqual(2)
    frames.forEach((f) => {
      expect(f.provider).toBe('xai')
    })
  })

  it('records timeToFirstToken > 0 when startTime is in the past', async () => {
    const startTime = Date.now() - 50
    const stream = buildNdjsonStream(
      {
        textStream: makeTextStream(['hi']),
        usage: Promise.resolve({ inputTokens: 1, outputTokens: 1 } as never),
        costFor: () => 0,
      },
      startTime,
      'openai',
    )

    const frames = await drainStream(stream)
    const meta = frames.find((f) => f.t === 'meta')
    expect((meta!.timeToFirstToken as number)).toBeGreaterThan(0)
  })

  it('emits an error frame (with isRateLimit=false) on stream failure', async () => {
    async function* failingStream(): AsyncIterable<string> {
      yield 'partial'
      throw new Error('upstream failure')
    }

    const stream = buildNdjsonStream(
      {
        textStream: failingStream(),
        usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 } as never),
        costFor: () => 0,
      },
      Date.now(),
      'openai',
    )

    const frames = await drainStream(stream)
    const errorFrame = frames.find((f) => f.t === 'error')
    expect(errorFrame).toBeDefined()
    expect(errorFrame).toMatchObject({ t: 'error', provider: 'openai', isRateLimit: false })
    expect(typeof errorFrame!.v).toBe('string')
  })

  it('emits an error frame with isRateLimit=true for 429 errors', async () => {
    async function* rateLimitStream(): AsyncIterable<string> {
      const err = Object.assign(new Error('Too many requests'), { status: 429 })
      throw err
    }

    const stream = buildNdjsonStream(
      {
        textStream: rateLimitStream(),
        usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 } as never),
        costFor: () => 0,
      },
      Date.now(),
      'openai',
    )

    const frames = await drainStream(stream)
    const errorFrame = frames.find((f) => f.t === 'error')
    expect(errorFrame).toMatchObject({ t: 'error', isRateLimit: true })
  })

  it('emits an empty stream cleanly when no chunks are produced', async () => {
    const stream = buildNdjsonStream(
      {
        textStream: makeTextStream([]),
        usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 } as never),
        costFor: () => 0,
      },
      Date.now(),
      'openai',
    )

    const frames = await drainStream(stream)
    const textFrames = frames.filter((f) => f.t === 'text')
    const metaFrame = frames.find((f) => f.t === 'meta')
    expect(textFrames).toHaveLength(0)
    expect(metaFrame).toMatchObject({ responseLength: 0 })
  })
})
