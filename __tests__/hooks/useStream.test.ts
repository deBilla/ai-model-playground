/**
 * Confirms that chatSettings from the Zustand store are captured at run() time
 * and forwarded to consumeMultiplexedStream.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlaygroundStore } from '@/lib/store'
import { MODELS } from '@/lib/models.config'

// ─── Mock compareStream before importing useStream ────────────────────────────
vi.mock('@/lib/compareStream', () => ({
  consumeMultiplexedStream: vi.fn().mockResolvedValue([]),
  abortCompareStream: vi.fn(),
}))

// Import after mock is registered
import { useStream } from '@/hooks/useStream'
import * as compareStreamModule from '@/lib/compareStream'

const mockedConsume = vi.mocked(compareStreamModule.consumeMultiplexedStream)

// Reset store state between tests
function resetStore() {
  usePlaygroundStore.setState({
    prompt: '',
    panels: Object.fromEntries(
      MODELS.map((m) => [m.id, { status: 'idle', streamedText: '', metrics: undefined, error: undefined, isRateLimit: false }]),
    ) as never,
    history: [],
    user: null,
    chatSettings: { temperature: 1.0, maxTokens: 2048 },
  })
}

describe('useStream — chatSettings forwarding', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    mockedConsume.mockResolvedValue([])
  })

  it('passes chatSettings from the store to consumeMultiplexedStream', async () => {
    // Arrange: set custom settings
    usePlaygroundStore.getState().setChatSettings({ temperature: 0.3, maxTokens: 512 })

    const { result } = renderHook(() => useStream())

    // Act
    await act(async () => {
      await result.current.run('What is 2+2?')
    })

    // Assert: single call with correct prompt and settings
    expect(mockedConsume).toHaveBeenCalledOnce()
    const [prompt, , settings] = mockedConsume.mock.calls[0]
    expect(prompt).toBe('What is 2+2?')
    expect(settings).toEqual({ temperature: 0.3, maxTokens: 512 })
  })

  it('uses the default settings (temp=1.0, maxTokens=2048) when unchanged', async () => {
    const { result } = renderHook(() => useStream())

    await act(async () => {
      await result.current.run('Hello')
    })

    expect(mockedConsume).toHaveBeenCalledOnce()
    expect(mockedConsume.mock.calls[0][2]).toEqual({ temperature: 1.0, maxTokens: 2048 })
  })

  it('snapshots settings at run() time — later mutations do not affect in-flight calls', async () => {
    // Set initial settings
    usePlaygroundStore.getState().setChatSettings({ temperature: 0.1, maxTokens: 256 })

    // Make consumeMultiplexedStream take a tick so we can mutate settings concurrently
    mockedConsume.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 0)),
    )

    const { result } = renderHook(() => useStream())

    let runPromise!: Promise<void>
    act(() => {
      runPromise = result.current.run('test')
    })

    // Mutate settings after run() has started
    await act(async () => {
      usePlaygroundStore.getState().setChatSettings({ temperature: 1.9, maxTokens: 4096 })
    })

    await act(async () => { await runPromise })

    // The call should use the original snapshot
    expect(mockedConsume.mock.calls[0][2]).toEqual({ temperature: 0.1, maxTokens: 256 })
  })

  it('stop() calls abortCompareStream', () => {
    const { result } = renderHook(() => useStream())
    result.current.stop()
    expect(compareStreamModule.abortCompareStream).toHaveBeenCalledOnce()
  })

  it('does not start a new run while one is already in progress', async () => {
    let resolveFirst!: () => void
    mockedConsume.mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirst = () => resolve([]) }),
    )

    const { result } = renderHook(() => useStream())

    // Start first run (does not await)
    act(() => { result.current.run('first') })

    // Attempt concurrent second run immediately
    await act(async () => { await result.current.run('second') })

    // 'second' should have been ignored — only one call total
    expect(mockedConsume).toHaveBeenCalledOnce()

    // Clean up
    resolveFirst()
  })
})
