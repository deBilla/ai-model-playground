'use client'

import { useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { LogOut, LogIn } from 'lucide-react'
import { usePlaygroundStore } from '@/lib/store'
import { MODELS } from '@/lib/models.config'
import { useStream } from '@/hooks/useStream'
import type { User } from '@/lib/types'
import PromptInput from '@/components/PromptInput'
import CompareLayout from '@/components/CompareLayout'
import AuthModal from '@/components/AuthModal'
import UpgradeBanner from '@/components/UpgradeBanner'
import { Button } from '@/components/ui/button'

const HistoryDrawer = dynamic(
  () => import('@/components/HistoryDrawer'), 
  { ssr: false }
)

export default function HomeClient() {
  const setUser = usePlaygroundStore((s) => s.setUser)
  const clearUser = usePlaygroundStore((s) => s.clearUser)
  const setGuestComparisonCount = usePlaygroundStore((s) => s.setGuestComparisonCount)
  const setShowAuthModal = usePlaygroundStore((s) => s.setShowAuthModal)
  const user = usePlaygroundStore((s) => s.user)
  const { run, stop } = useStream()

  useEffect(() => {
    fetch('/api/guest/init', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user as User)
          setGuestComparisonCount(data.guestComparisonCount ?? 0)
        }
      })
      .catch(() => {})
  }, [setUser, setGuestComparisonCount])

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch { /* ignore */ }
    clearUser()
    fetch('/api/guest/init', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user as User)
          setGuestComparisonCount(data.guestComparisonCount ?? 0)
        }
      })
      .catch(() => {})
  }, [clearUser, setUser, setGuestComparisonCount])

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <AuthModal />

      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            AI Model Playground
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            {MODELS.map((m) => m.label).join(' · ')} — side by side
          </p>
        </div>
        <div className="flex items-center gap-3">
          {user && !user.isGuest ? (
            <>
              <span className="text-xs text-neutral-400 hidden sm:block">
                {user.name ?? user.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-neutral-400 hover:text-white gap-1.5 h-8 px-2"
                aria-label="Log out"
              >
                <LogOut size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAuthModal(true)}
              className="text-neutral-400 hover:text-white gap-1.5 h-8 px-2"
            >
              <LogIn size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Sign in</span>
            </Button>
          )}
        </div>
      </header>

      <UpgradeBanner />

      <main className="flex flex-col flex-1 px-4 sm:px-6 py-6 gap-6 min-h-0">
        <section className="flex-shrink-0">
          <PromptInput onSubmit={run} onStop={stop} />
        </section>
        <section className="flex-1 min-h-0" style={{ minHeight: '500px' }}>
          <CompareLayout />
        </section>
      </main>

      <HistoryDrawer />
    </div>
  )
}