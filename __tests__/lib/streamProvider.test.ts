/**
 * Tests that confirm chatSettings (temperature, maxTokens) flow from the caller
 * all the way into the HTTP request body sent to /api/chats.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PanelState } from '@/lib/types'
import type { ProviderId } from '@/lib/models.config'

// streamProvider uses fetch — we stub it globally
const noop = vi.fn()

// Intersection type: callable with the exact signature streamProvider expects,
// while retaining the vi.fn() mock API (.mock.calls, etc.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PanelSetterMock = ReturnType<typeof vi.fn<any>> & ((provider: ProviderId, state: Partial<PanelState>) => void)

function makePanelSetter(): PanelSetterMock {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return vi.fn<any>() as unknown as PanelSetterMock
}

// A ReadableStream that immediately closes (simulates a completed but empty body)
function makeEmptyBody(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.close()
    },
  })
}

// Minimal ok response with a body that closes immediately
function makeOkResponse(chunks: string[] = []): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
  return new Response(body, { status: 200 })
}

describe('streamProvider — chatSettings forwarding', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', noop)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    // Reset AbortController state between tests by re-importing (module is stateful)
  })

  it('includes temperature and maxTokens in the POST body sent to /api/chats', async () => {
    noop.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('HTTP 401 Unauthorized'),
    })

    const { streamProvider } = await import('@/lib/streamProvider')
    await streamProvider('openai', 'hello world', makePanelSetter(), {
      temperature: 0.42,
      maxTokens: 512,
    })

    expect(noop).toHaveBeenCalledOnce()
    const [url, init] = noop.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/chats')
    expect(init.method).toBe('POST')

    const body = JSON.parse(init.body as string)
    expect(body.temperature).toBe(0.42)
    expect(body.maxTokens).toBe(512)
    expect(body.prompt).toBe('hello world')
    expect(body.provider).toBe('openai')
  })

  it('omits temperature/maxTokens from body when settings are not provided', async () => {
    noop.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('HTTP 401'),
    })

    const { streamProvider } = await import('@/lib/streamProvider')
    await streamProvider('anthropic', 'test', makePanelSetter())

    const [, init] = noop.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.temperature).toBeUndefined()
    expect(body.maxTokens).toBeUndefined()
  })

  it('sets panel status to loading then error on non-ok response', async () => {
    noop.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('Forbidden'),
    })

    const { streamProvider } = await import('@/lib/streamProvider')
    const setPanelState = makePanelSetter()
    await streamProvider('openai', 'prompt', setPanelState, { temperature: 1, maxTokens: 1024 })

    const calls = (setPanelState.mock.calls as Array<[ProviderId, Partial<PanelState>]>).map((c) => c[1])
    expect(calls[0]).toMatchObject({ status: 'loading' })
    expect(calls.at(-1)).toMatchObject({ status: 'error' })
  })

  it('parses text and meta NDJSON frames from a successful stream', async () => {
    const metaFrame = JSON.stringify({
      t: 'meta',
      provider: 'openai',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      latencyMs: 300,
      estimatedCost: 0.001,
      timeToFirstToken: 100,
      tokensPerSecond: 16.7,
      responseLength: 5,
    })
    const ndjson = [
      JSON.stringify({ t: 'text', provider: 'openai', v: 'Hello' }),
      JSON.stringify({ t: 'text', provider: 'openai', v: '!' }),
      metaFrame,
    ].join('\n') + '\n'

    noop.mockResolvedValue(makeOkResponse([ndjson]))

    const { streamProvider } = await import('@/lib/streamProvider')
    const setPanelState = makePanelSetter()
    const result = await streamProvider('openai', 'hi', setPanelState, { temperature: 0.5, maxTokens: 2048 })

    expect(result).not.toBeNull()
    expect(result!.responseText).toBe('Hello!')
    expect(result!.promptTokens).toBe(10)
    expect(result!.completionTokens).toBe(5)
    expect(result!.provider).toBe('openai')

    // Final panel state should be 'done'
    const lastCall = setPanelState.mock.calls.at(-1)![1] as Partial<PanelState>
    expect(lastCall.status).toBe('done')
  })

  it('discards frames from a different provider (cross-contamination guard)', async () => {
    const ndjson = [
      // Frame from wrong provider — should be ignored
      JSON.stringify({ t: 'text', provider: 'anthropic', v: 'WRONG' }),
      JSON.stringify({ t: 'text', provider: 'openai', v: 'correct' }),
      JSON.stringify({ t: 'meta', provider: 'openai', promptTokens: 1, completionTokens: 1, totalTokens: 2, latencyMs: 100, estimatedCost: 0, timeToFirstToken: 50, tokensPerSecond: 10, responseLength: 7 }),
    ].join('\n') + '\n'

    noop.mockResolvedValue(makeOkResponse([ndjson]))

    const { streamProvider } = await import('@/lib/streamProvider')
    const result = await streamProvider('openai', 'prompt', makePanelSetter(), { temperature: 1, maxTokens: 512 })

    expect(result!.responseText).toBe('correct')
    expect(result!.responseText).not.toContain('WRONG')
  })
})
