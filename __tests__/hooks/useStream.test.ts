/**
 * Confirms that chatSettings from the Zustand store are captured at run() time
 * and forwarded to every streamProvider call.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlaygroundStore } from '@/lib/store'
import { MODELS } from '@/lib/models.config'

// ─── Mock streamProvider before importing useStream ──────────────────────────
vi.mock('@/lib/streamProvider', () => ({
  streamProvider: vi.fn().mockResolvedValue(null),
  abortAllProviders: vi.fn(),
}))

// Import after mock is registered
import { useStream } from '@/hooks/useStream'
import * as streamProviderModule from '@/lib/streamProvider'

const mockedStreamProvider = vi.mocked(streamProviderModule.streamProvider)

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
    mockedStreamProvider.mockResolvedValue(null)
  })

  it('passes chatSettings from the store to each streamProvider call', async () => {
    // Arrange: set custom settings
    usePlaygroundStore.getState().setChatSettings({ temperature: 0.3, maxTokens: 512 })

    const { result } = renderHook(() => useStream())

    // Act
    await act(async () => {
      await result.current.run('What is 2+2?')
    })

    // Assert: every model was called with the correct settings snapshot
    expect(mockedStreamProvider).toHaveBeenCalledTimes(MODELS.length)

    for (const call of mockedStreamProvider.mock.calls) {
      const [, prompt, , settings] = call
      expect(prompt).toBe('What is 2+2?')
      expect(settings).toEqual({ temperature: 0.3, maxTokens: 512 })
    }
  })

  it('uses the default settings (temp=1.0, maxTokens=2048) when unchanged', async () => {
    const { result } = renderHook(() => useStream())

    await act(async () => {
      await result.current.run('Hello')
    })

    for (const call of mockedStreamProvider.mock.calls) {
      expect(call[3]).toEqual({ temperature: 1.0, maxTokens: 2048 })
    }
  })

  it('snapshots settings at run() time — later mutations do not affect in-flight calls', async () => {
    // Set initial settings
    usePlaygroundStore.getState().setChatSettings({ temperature: 0.1, maxTokens: 256 })

    // Make streamProvider take a tick so we can mutate settings concurrently
    mockedStreamProvider.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(null), 0)),
    )

    const { result } = renderHook(() => useStream())

    let runPromise!: Promise<void>
    act(() => {
      runPromise = result.current.run('test')
    })

    // Mutate settings after run() has started (wrapped in act because the hook reads this value)
    await act(async () => {
      usePlaygroundStore.getState().setChatSettings({ temperature: 1.9, maxTokens: 4096 })
    })

    await act(async () => { await runPromise })

    // All calls should use the original snapshot
    for (const call of mockedStreamProvider.mock.calls) {
      expect(call[3]).toEqual({ temperature: 0.1, maxTokens: 256 })
    }
  })

  it('passes the correct provider ID for each model', async () => {
    const { result } = renderHook(() => useStream())

    await act(async () => {
      await result.current.run('test')
    })

    const calledProviders = mockedStreamProvider.mock.calls.map((c) => c[0])
    const expectedProviders = MODELS.map((m) => m.id)
    expect(calledProviders.sort()).toEqual(expectedProviders.sort())
  })

  it('stop() calls abortAllProviders', () => {
    const { result } = renderHook(() => useStream())
    result.current.stop()
    expect(streamProviderModule.abortAllProviders).toHaveBeenCalledOnce()
  })

  it('does not start a new run while one is already in progress', async () => {
    let resolveFirst!: () => void
    mockedStreamProvider.mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirst = () => resolve(null) }),
    )

    const { result } = renderHook(() => useStream())

    // Start first run (does not await)
    act(() => { result.current.run('first') })

    // Attempt concurrent second run immediately
    await act(async () => { await result.current.run('second') })

    // 'second' should have been ignored — only MODELS.length calls total
    expect(mockedStreamProvider).toHaveBeenCalledTimes(MODELS.length)

    // Clean up
    resolveFirst()
  })
})
