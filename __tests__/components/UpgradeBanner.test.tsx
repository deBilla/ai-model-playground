import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UpgradeBanner from '@/components/UpgradeBanner'
import { usePlaygroundStore } from '@/lib/store'
import { GUEST_COMPARISON_LIMIT } from '@/lib/constants'

vi.mock('@/lib/store', () => ({
  usePlaygroundStore: vi.fn(),
}))

const mockSetShowAuthModal = vi.fn()

const GUEST_USER = {
  id: 'guest-1',
  email: null,
  name: null,
  isGuest: true,
  createdAt: '2025-01-01T00:00:00Z',
}

const REAL_USER = {
  id: 'user-1',
  email: 'a@b.com',
  name: 'Alice',
  isGuest: false,
  createdAt: '2025-01-01T00:00:00Z',
}

function setup(overrides: { user?: typeof GUEST_USER | typeof REAL_USER | null; guestComparisonCount?: number } = {}) {
  const state = {
    user: null,
    guestComparisonCount: 0,
    setShowAuthModal: mockSetShowAuthModal,
    ...overrides,
  }
  vi.mocked(usePlaygroundStore).mockImplementation((selector: any) => selector(state))
}

describe('UpgradeBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when user is null', () => {
    setup({ user: null })
    const { container } = render(<UpgradeBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when user is a real (non-guest) user', () => {
    setup({ user: REAL_USER, guestComparisonCount: 99 })
    const { container } = render(<UpgradeBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when guest count is below the limit', () => {
    setup({ user: GUEST_USER, guestComparisonCount: GUEST_COMPARISON_LIMIT - 1 })
    const { container } = render(<UpgradeBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the banner when guest count exactly equals the limit', () => {
    setup({ user: GUEST_USER, guestComparisonCount: GUEST_COMPARISON_LIMIT })
    render(<UpgradeBanner />)
    expect(screen.getByText(/you've used all/i)).toBeInTheDocument()
  })

  it('renders the banner when guest count exceeds the limit', () => {
    setup({ user: GUEST_USER, guestComparisonCount: GUEST_COMPARISON_LIMIT + 1 })
    render(<UpgradeBanner />)
    expect(screen.getByText(/you've used all/i)).toBeInTheDocument()
  })

  it('clicking "Sign up" calls setShowAuthModal(true)', () => {
    setup({ user: GUEST_USER, guestComparisonCount: GUEST_COMPARISON_LIMIT })
    render(<UpgradeBanner />)
    fireEvent.click(screen.getByText('Sign up'))
    expect(mockSetShowAuthModal).toHaveBeenCalledWith(true)
  })

  it('clicking "log in" calls setShowAuthModal(true)', () => {
    setup({ user: GUEST_USER, guestComparisonCount: GUEST_COMPARISON_LIMIT })
    render(<UpgradeBanner />)
    fireEvent.click(screen.getByText('log in'))
    expect(mockSetShowAuthModal).toHaveBeenCalledWith(true)
  })

  it('clicking the dismiss button hides the banner', () => {
    setup({ user: GUEST_USER, guestComparisonCount: GUEST_COMPARISON_LIMIT })
    render(<UpgradeBanner />)
    expect(screen.getByText(/you've used all/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/you've used all/i)).not.toBeInTheDocument()
  })

  it('shows the GUEST_COMPARISON_LIMIT count in the message', () => {
    setup({ user: GUEST_USER, guestComparisonCount: GUEST_COMPARISON_LIMIT })
    render(<UpgradeBanner />)
    expect(screen.getByText(new RegExp(String(GUEST_COMPARISON_LIMIT)))).toBeInTheDocument()
  })
})
