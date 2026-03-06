import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import HistoryDrawer from '@/components/HistoryDrawer'
import { usePlaygroundStore } from '@/lib/store'
import type { ComparisonRecord } from '@/lib/types'
import { useHistory } from '@/lib/hooks/useHistory'

vi.mock('@/lib/store', () => ({
  usePlaygroundStore: vi.fn(),
}))

const mockGetHistory = vi.fn()
const mockDeleteComparison = vi.fn()

vi.mock('@/lib/hooks/useHistory', () => ({
  useHistory: () => ({
    getHistory: mockGetHistory,
    deleteComparison: mockDeleteComparison,
  }),
}))

const mockSetHistory = vi.fn()
const mockAppendHistory = vi.fn()
const mockRemoveFromHistory = vi.fn()
const mockSetPrompt = vi.fn()
const mockSetPanelState = vi.fn()

const REAL_USER = {
  id: 'user-1',
  email: 'a@b.com',
  name: 'Alice',
  isGuest: false,
  createdAt: '2025-01-01T00:00:00Z',
}

const MOCK_RECORD: ComparisonRecord = {
  id: 'comp-1',
  prompt: 'What is the capital of France?',
  createdAt: '2025-01-15T10:30:00Z',
  shareToken: 'share-abc123',
  responses: [
    {
      provider: 'openai',
      label: 'GPT-4o',
      responseText: 'Paris.',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      estimatedCost: 0.0001,
      latencyMs: 500,
      timeToFirstToken: 100,
      tokensPerSecond: 10,
      responseLength: 6,
    },
  ],
}

const MOCK_RECORD_NO_SHARE: ComparisonRecord = {
  ...MOCK_RECORD,
  id: 'comp-2',
  shareToken: null,
  prompt: 'Another prompt without share',
}

function setup(overrides: {
  user?: typeof REAL_USER | null
  history?: typeof MOCK_RECORD[]
} = {}) {
  const state = {
    user: REAL_USER,
    history: [] as typeof MOCK_RECORD[],
    setHistory: mockSetHistory,
    appendHistory: mockAppendHistory,
    removeFromHistory: mockRemoveFromHistory,
    setPrompt: mockSetPrompt,
    setPanelState: mockSetPanelState,
    ...overrides,
  }
  vi.mocked(usePlaygroundStore).mockImplementation((selector: any) => selector(state))
}

// Default fetch mock: returns empty page with no errors
function mockEmptyFetch() {
  mockGetHistory.mockResolvedValue({
    data: [],
    hasMore: false,
    limit: 20,
    page: 1,
    total: 0
  })
}

describe('HistoryDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmptyFetch()
  })

  // ─── Trigger button ────────────────────────────────────────────────────────

  describe('trigger button', () => {
    it('renders the trigger button', async () => {
      setup({ user: null })
      render(<HistoryDrawer />)
      expect(
        await screen.findByRole('button', { name: /open comparison history/i })
      ).toBeInTheDocument()
    })

    it('shows "History" text with no count when history is empty', async () => {
      setup({ history: [] })
      render(<HistoryDrawer />)
      expect(await screen.findByText(/History/)).toBeInTheDocument()
      expect(screen.queryByText(/History \(\d/)).not.toBeInTheDocument()
    })

    it('shows history count in trigger when records exist', async () => {
      setup({ history: [MOCK_RECORD] })
      render(<HistoryDrawer />)
      expect(await screen.findByText(/History \(1\)/)).toBeInTheDocument()
    })
  })

  // ─── Opening the drawer ────────────────────────────────────────────────────

  describe('drawer content', () => {
    it('opens the drawer when trigger is clicked', async () => {
      setup()
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))
      await waitFor(() =>
        expect(screen.getByText('Comparison History')).toBeInTheDocument()
      )
    })

    it('shows "Sign in to view" message when user is null', async () => {
      setup({ user: null, history: [] })
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))
      await waitFor(() =>
        expect(screen.getByText(/sign in to view/i)).toBeInTheDocument()
      )
    })

    it('shows "No comparisons yet" when logged-in user has empty history', async () => {
      setup({ user: REAL_USER, history: [] })
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))
      await waitFor(() =>
        expect(screen.getByText(/no comparisons yet/i)).toBeInTheDocument()
      )
    })

    it('renders a card for each history record', async () => {
      setup({ user: REAL_USER, history: [MOCK_RECORD] })
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))
      await waitFor(() =>
        expect(screen.getByText(MOCK_RECORD.prompt)).toBeInTheDocument()
      )
    })

    it('shows provider label badge on history card', async () => {
      setup({ user: REAL_USER, history: [MOCK_RECORD] })
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))
      await waitFor(() =>
        expect(screen.getByText('GPT-4o')).toBeInTheDocument()
      )
    })

    it('shows record count in drawer header when records exist', async () => {
      setup({ user: REAL_USER, history: [MOCK_RECORD] })
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))
      await waitFor(() =>
        expect(screen.getByText('1 saved')).toBeInTheDocument()
      )
    })
  })

  // ─── Restoring a comparison ────────────────────────────────────────────────

  describe('restore comparison', () => {
    it('calls setPrompt when a history card is clicked', async () => {
      setup({ user: REAL_USER, history: [MOCK_RECORD] })
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))
      await waitFor(() => expect(screen.getByText(MOCK_RECORD.prompt)).toBeInTheDocument())

      // Click the prompt text (the card's button)
      fireEvent.click(screen.getByText(MOCK_RECORD.prompt))

      expect(mockSetPrompt).toHaveBeenCalledWith(MOCK_RECORD.prompt)
    })

    it('calls setPanelState for the response provider when restoring', async () => {
      setup({ user: REAL_USER, history: [MOCK_RECORD] })
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))
      await waitFor(() => expect(screen.getByText(MOCK_RECORD.prompt)).toBeInTheDocument())

      fireEvent.click(screen.getByText(MOCK_RECORD.prompt))

      expect(mockSetPanelState).toHaveBeenCalledWith(
        'openai',
        expect.objectContaining({ status: 'done', streamedText: 'Paris.' })
      )
    })
  })

  // ─── Share button ──────────────────────────────────────────────────────────

  describe('share button', () => {
    it('shows share button for records with shareToken', async () => {
      setup({ user: REAL_USER, history: [MOCK_RECORD] })
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /copy share link/i })).toBeInTheDocument()
      )
    })

    it('hides share button for records without shareToken', async () => {
      setup({ user: REAL_USER, history: [MOCK_RECORD_NO_SHARE] })
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))
      await waitFor(() =>
        expect(screen.getByText(MOCK_RECORD_NO_SHARE.prompt)).toBeInTheDocument()
      )
      expect(screen.queryByRole('button', { name: /copy share link/i })).not.toBeInTheDocument()
    })

    it('copies the share URL to clipboard when share button is clicked', async () => {
      setup({ user: REAL_USER, history: [MOCK_RECORD] })
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /copy share link/i })).toBeInTheDocument()
      )

      fireEvent.click(screen.getByRole('button', { name: /copy share link/i }))

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('share-abc123')
        )
      })
    })

    it('shows "Share link copied" toast after clicking share', async () => {
      setup({ user: REAL_USER, history: [MOCK_RECORD] })
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /copy share link/i })).toBeInTheDocument()
      )

      fireEvent.click(screen.getByRole('button', { name: /copy share link/i }))

      await waitFor(() =>
        expect(screen.getByText(/share link copied to clipboard/i)).toBeInTheDocument()
      )
    })
  })

  // ─── Delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('does not delete when confirm dialog is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
      setup({ user: REAL_USER, history: [MOCK_RECORD] })
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))

      await waitFor(() =>
        // Delete button has aria-label starting with "Delete:"
        expect(screen.getByRole('button', { name: /^delete:/i })).toBeInTheDocument()
      )

      fireEvent.click(screen.getByRole('button', { name: /^delete:/i }))
      expect(mockDeleteComparison).not.toHaveBeenCalled()
    })

    it('calls DELETE API when confirm dialog is accepted', async () => {
      vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
      mockDeleteComparison.mockResolvedValue(undefined)

      setup({ user: REAL_USER, history: [MOCK_RECORD] })
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /^delete:/i })).toBeInTheDocument()
      )

      fireEvent.click(screen.getByRole('button', { name: /^delete:/i }))

      await waitFor(() => {
        expect(mockDeleteComparison).toHaveBeenCalledWith('comp-1')
      })
    })

    it('calls removeFromHistory after successful delete', async () => {
      vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
      mockDeleteComparison.mockResolvedValue(undefined)

      setup({ user: REAL_USER, history: [MOCK_RECORD] })
      render(<HistoryDrawer />)
      fireEvent.click(screen.getByRole('button', { name: /open comparison history/i }))
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /^delete:/i })).toBeInTheDocument()
      )

      fireEvent.click(screen.getByRole('button', { name: /^delete:/i }))

      await waitFor(() =>
        expect(mockRemoveFromHistory).toHaveBeenCalledWith('comp-1')
      )
    })
  })

  // ─── API fetching ──────────────────────────────────────────────────────────

  describe('data fetching', () => {
    it('fetches comparisons on mount when user is set', async () => {
      setup({ user: REAL_USER })
      render(<HistoryDrawer />)

      await waitFor(() => {
        expect(mockGetHistory).toHaveBeenCalledWith(
          1,
          20,
          true,
          expect.any(AbortSignal)
        )
      })
    })

    it('does not fetch when user is null', async () => {
      setup({ user: null })
      render(<HistoryDrawer />)

      // Wait a tick to give any fetch a chance to fire
      await new Promise((r) => setTimeout(r, 50))
      expect(mockGetHistory).not.toHaveBeenCalled()
    })
  })
})
