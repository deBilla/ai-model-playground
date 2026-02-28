'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { usePlaygroundStore } from '@/lib/store'
import { GUEST_COMPARISON_LIMIT } from '@/lib/constants'
import type { User } from '@/lib/types'
import { ArrowRight, ChevronLeft, Infinity, History, Share2 } from 'lucide-react'

type View = 'gate' | 'login' | 'register'

interface FieldErrors {
  email?: string[]
  password?: string[]
  name?: string[]
}

// ─── Gate screen ─────────────────────────────────────────────────────────────

function GateScreen({ onRegister, onLogin }: { onRegister: () => void; onLogin: () => void }) {
  return (
    <div className="p-8 flex flex-col items-center text-center gap-6">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
        <ArrowRight className="text-sky-400" size={26} />
      </div>

      {/* Headline */}
      <div className="space-y-2">
        <DialogTitle className="text-xl font-semibold text-white leading-tight">
          To keep going, let&apos;s get you set up
        </DialogTitle>
        <DialogDescription className="text-sm text-neutral-400 max-w-xs mx-auto">
          You&apos;ve used all {GUEST_COMPARISON_LIMIT} free comparisons. Create a free account to keep
          comparing models — no credit card required.
        </DialogDescription>
      </div>

      {/* Value props */}
      <ul className="w-full space-y-2.5 text-left">
        {[
          { icon: <Infinity size={15} />, text: 'Unlimited model comparisons' },
          { icon: <History size={15} />, text: 'Full history saved across sessions' },
          { icon: <Share2 size={15} />, text: 'Share results with a link' },
        ].map(({ icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-sm text-neutral-300">
            <span className="text-sky-400 shrink-0">{icon}</span>
            {text}
          </li>
        ))}
      </ul>

      {/* CTAs */}
      <div className="w-full space-y-3 pt-1">
        <Button
          onClick={onRegister}
          className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium h-10 gap-2"
        >
          Create free account
          <ArrowRight size={15} />
        </Button>
        <button
          onClick={onLogin}
          className="w-full text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          Already have an account?{' '}
          <span className="text-sky-400 hover:text-sky-300 font-medium">Sign in</span>
        </button>
      </div>
    </div>
  )
}

// ─── Form screen ─────────────────────────────────────────────────────────────

function FormScreen({
  view,
  onBack,
  onSuccess,
  onSwitchView,
}: {
  view: 'login' | 'register'
  onBack: (() => void) | null
  onSuccess: (user: User) => void
  onSwitchView: (v: 'login' | 'register') => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => firstInputRef.current?.focus(), 80)
  }, [view])

  const reset = () => { setEmail(''); setPassword(''); setName(''); setErrors({}); setServerError('') }

  const switchTo = (v: 'login' | 'register') => { reset(); onSwitchView(v) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setServerError('')
    if (!email.includes('@')) { setErrors({ email: ['Enter a valid email'] }); return }
    if (password.length < 8) { setErrors({ password: ['Password must be at least 8 characters'] }); return }

    setLoading(true)
    const endpoint = view === 'login' ? '/api/auth/login' : '/api/auth/register'
    const body = view === 'login' ? { email, password } : { email, password, name: name || undefined }
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (typeof data.error === 'object') { setErrors(data.error) } else { setServerError(data.error ?? 'Something went wrong') }
        return
      }
      onSuccess(data.user as User)
    } catch {
      setServerError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 flex flex-col gap-5">
      {/* Header row */}
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="text-neutral-400 hover:text-neutral-200 transition-colors p-1 -ml-1 rounded"
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <DialogTitle className="text-base font-semibold text-white">
          {view === 'login' ? 'Welcome back' : 'Create your account'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {view === 'login' ? 'Sign in to your account' : 'Register for a new account'}
        </DialogDescription>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        {view === 'register' && (
          <div>
            <label className="block text-xs text-neutral-400 mb-1" htmlFor="auth-name">
              Name <span className="text-neutral-600">(optional)</span>
            </label>
            <input
              id="auth-name"
              ref={view === 'register' ? firstInputRef : undefined}
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              placeholder="Your name"
            />
          </div>
        )}

        <div>
          <label className="block text-xs text-neutral-400 mb-1" htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            ref={view === 'login' ? firstInputRef : undefined}
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoComplete="email"
            className={`w-full rounded-lg border bg-neutral-800/60 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${errors.email ? 'border-red-500' : 'border-neutral-700'}`}
            placeholder="you@example.com"
          />
          {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email[0]}</p>}
        </div>

        <div>
          <label className="block text-xs text-neutral-400 mb-1" htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required autoComplete={view === 'login' ? 'current-password' : 'new-password'}
            className={`w-full rounded-lg border bg-neutral-800/60 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${errors.password ? 'border-red-500' : 'border-neutral-700'}`}
            placeholder={view === 'register' ? 'Min 8 characters' : '••••••••'}
          />
          {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password[0]}</p>}
        </div>

        {serverError && <p className="text-xs text-red-400" role="alert">{serverError}</p>}

        <Button
          type="submit" disabled={loading}
          className="w-full bg-sky-600 hover:bg-sky-500 h-10 font-medium mt-1"
        >
          {loading ? 'Please wait…' : view === 'login' ? 'Sign In' : 'Create Account'}
        </Button>
      </form>

      {/* Switch mode link */}
      <p className="text-center text-sm text-neutral-500">
        {view === 'login' ? (
          <>No account?{' '}
            <button onClick={() => switchTo('register')} className="text-sky-400 hover:text-sky-300 font-medium transition-colors">
              Create one free
            </button>
          </>
        ) : (
          <>Already registered?{' '}
            <button onClick={() => switchTo('login')} className="text-sky-400 hover:text-sky-300 font-medium transition-colors">
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function AuthModal() {
  const showAuthModal = usePlaygroundStore((s) => s.showAuthModal)
  const setShowAuthModal = usePlaygroundStore((s) => s.setShowAuthModal)
  const setUser = usePlaygroundStore((s) => s.setUser)
  const setGuestComparisonCount = usePlaygroundStore((s) => s.setGuestComparisonCount)
  const user = usePlaygroundStore((s) => s.user)
  const guestComparisonCount = usePlaygroundStore((s) => s.guestComparisonCount)

  const isLimitReached = !!user?.isGuest && guestComparisonCount >= GUEST_COMPARISON_LIMIT

  const [view, setView] = useState<View>('gate')

  // Reset view each time the modal opens
  useEffect(() => {
    if (showAuthModal) {
      setView(isLimitReached ? 'gate' : 'login')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAuthModal])

  const handleSuccess = (u: User) => {
    setUser(u)
    setGuestComparisonCount(0)
    setShowAuthModal(false)
  }

  return (
    <Dialog open={showAuthModal} onOpenChange={(open) => { if (!open) setShowAuthModal(false) }}>
      <DialogContent className="sm:max-w-sm bg-neutral-900 border-neutral-700 text-white p-0 overflow-hidden [&>button]:text-neutral-400">
        {view === 'gate' ? (
          <GateScreen
            onRegister={() => setView('register')}
            onLogin={() => setView('login')}
          />
        ) : (
          <FormScreen
            view={view}
            onBack={isLimitReached ? () => setView('gate') : null}
            onSuccess={handleSuccess}
            onSwitchView={setView}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
