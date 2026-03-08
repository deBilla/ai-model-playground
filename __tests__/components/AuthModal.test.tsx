import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AuthModal from '@/components/AuthModal'
import { usePlaygroundStore } from '@/lib/store'
import { GUEST_COMPARISON_LIMIT } from '@/lib/constants'
import { useAuth } from '@/lib/hooks/useAuth'

vi.mock('@/lib/store', () => ({
  usePlaygroundStore: vi.fn(),
}))

const mockLogin = vi.fn()
const mockRegister = vi.fn()

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
  }),
}))

const mockSetShowAuthModal = vi.fn()
const mockSetUser = vi.fn()
const mockSetGuestComparisonCount = vi.fn()

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

type SetupOptions = {
  showAuthModal?: boolean
  user?: typeof GUEST_USER | typeof REAL_USER | null
  guestComparisonCount?: number
}

function setup({ showAuthModal = false, user = null, guestComparisonCount = 0 }: SetupOptions = {}) {
  const state = {
    showAuthModal,
    user,
    guestComparisonCount,
    setShowAuthModal: mockSetShowAuthModal,
    setUser: mockSetUser,
    setGuestComparisonCount: mockSetGuestComparisonCount,
  }
  vi.mocked(usePlaygroundStore).mockImplementation((selector: any) => selector(state))
}

describe('AuthModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Closed state ───────────────────────────────────────────────────────────

  it('renders nothing (dialog hidden) when showAuthModal is false', () => {
    setup({ showAuthModal: false })
    render(<AuthModal />)
    // Dialog should not be open
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // ─── Login form (normal open — not limit reached) ────────────────────────

  describe('login form', () => {
    beforeEach(() => {
      setup({ showAuthModal: true, user: null, guestComparisonCount: 0 })
    })

    it('shows "Welcome back" heading', async () => {
      render(<AuthModal />)
      await waitFor(() => expect(screen.getByText('Welcome back')).toBeInTheDocument())
    })

    it('shows email and password fields', async () => {
      render(<AuthModal />)
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      })
    })

    it('shows a "Sign In" submit button', async () => {
      render(<AuthModal />)
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
      )
    })

    it('shows validation error for invalid email', async () => {
      render(<AuthModal />)
      await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'not-an-email' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

      expect(screen.getByText(/valid email/i)).toBeInTheDocument()
      expect(mockLogin).not.toHaveBeenCalled()
    })

    it('shows validation error for password shorter than 8 characters', async () => {
      render(<AuthModal />)
      await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'short' } })
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
      expect(mockLogin).not.toHaveBeenCalled()
    })

    it('calls login on valid login submission', async () => {
      mockLogin.mockResolvedValue(REAL_USER)

      render(<AuthModal />)
      await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'password123')
      })
    })

    it('calls setUser and closes modal on successful login', async () => {
      mockLogin.mockResolvedValue(REAL_USER)

      render(<AuthModal />)
      await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

      await waitFor(() => {
        expect(mockSetUser).toHaveBeenCalledWith(REAL_USER)
        expect(mockSetShowAuthModal).toHaveBeenCalledWith(false)
      })
    })

    it('shows server error message on failed login', async () => {
      mockLogin.mockRejectedValue('Invalid email or password')

      render(<AuthModal />)
      await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

      await waitFor(() =>
        expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
      )
    })

    it('shows a network error message when login throws', async () => {
      mockLogin.mockRejectedValue(new Error('Network error'))

      render(<AuthModal />)
      await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

      await waitFor(() =>
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      )
    })

    it('can switch to the register form via "Create one free"', async () => {
      render(<AuthModal />)
      await waitFor(() => expect(screen.getByText(/create one free/i)).toBeInTheDocument())

      fireEvent.click(screen.getByText(/create one free/i))

      expect(screen.getByText('Create your account')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    })

    it('register form shows Name, Email, and Password fields', async () => {
      render(<AuthModal />)
      await waitFor(() => expect(screen.getByText(/create one free/i)).toBeInTheDocument())
      fireEvent.click(screen.getByText(/create one free/i))

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    })

    it('register form has no back button (opened without gate screen)', async () => {
      render(<AuthModal />)
      await waitFor(() => expect(screen.getByText(/create one free/i)).toBeInTheDocument())
      fireEvent.click(screen.getByText(/create one free/i))

      // No back button when not coming from gate screen
      expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
    })

    it('calls register on valid register submission', async () => {
      mockRegister.mockResolvedValue(REAL_USER)

      render(<AuthModal />)
      await waitFor(() => expect(screen.getByText(/create one free/i)).toBeInTheDocument())
      fireEvent.click(screen.getByText(/create one free/i))

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'new@b.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'securepassword' } })
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith('new@b.com', 'securepassword', undefined)
      })
    })
  })

  // ─── Gate screen (limit reached) ────────────────────────────────────────────

  describe('gate screen (limit reached)', () => {
    beforeEach(() => {
      setup({
        showAuthModal: true,
        user: GUEST_USER,
        guestComparisonCount: GUEST_COMPARISON_LIMIT,
      })
    })

    it('shows the gate headline', async () => {
      render(<AuthModal />)
      await waitFor(() =>
        expect(screen.getByText(/to keep going/i)).toBeInTheDocument()
      )
    })

    it('shows "Unlimited model comparisons" value prop', async () => {
      render(<AuthModal />)
      await waitFor(() =>
        expect(screen.getByText(/unlimited model comparisons/i)).toBeInTheDocument()
      )
    })

    it('shows "Full history saved across sessions" value prop', async () => {
      render(<AuthModal />)
      await waitFor(() =>
        expect(screen.getByText(/full history saved/i)).toBeInTheDocument()
      )
    })

    it('shows "Share results with a link" value prop', async () => {
      render(<AuthModal />)
      await waitFor(() =>
        expect(screen.getByText(/share results with a link/i)).toBeInTheDocument()
      )
    })

    it('clicking "Create free account" navigates to register form', async () => {
      render(<AuthModal />)
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /create free account/i })).toBeInTheDocument()
      )
      fireEvent.click(screen.getByRole('button', { name: /create free account/i }))

      expect(screen.getByText('Create your account')).toBeInTheDocument()
    })

    it('clicking "Sign in" on gate navigates to login form', async () => {
      render(<AuthModal />)
      await waitFor(() => expect(screen.getByText(/to keep going/i)).toBeInTheDocument())

      // The "Sign in" link is a plain <button> on the gate screen
      fireEvent.click(screen.getByText(/^sign in$/i))

      await waitFor(() =>
        expect(screen.getByText('Welcome back')).toBeInTheDocument()
      )
    })

    it('register form (from gate) shows a back button', async () => {
      render(<AuthModal />)
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /create free account/i })).toBeInTheDocument()
      )
      fireEvent.click(screen.getByRole('button', { name: /create free account/i }))

      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    })

    it('back button returns to gate screen from register form', async () => {
      render(<AuthModal />)
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /create free account/i })).toBeInTheDocument()
      )
      fireEvent.click(screen.getByRole('button', { name: /create free account/i }))
      fireEvent.click(screen.getByRole('button', { name: /back/i }))

      await waitFor(() =>
        expect(screen.getByText(/to keep going/i)).toBeInTheDocument()
      )
    })
  })
})
