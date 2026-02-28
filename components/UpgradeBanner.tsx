'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePlaygroundStore } from '@/lib/store'
import { GUEST_COMPARISON_LIMIT } from '@/lib/constants'

export default function UpgradeBanner() {
  const user = usePlaygroundStore((s) => s.user)
  const guestComparisonCount = usePlaygroundStore((s) => s.guestComparisonCount)
  const setShowAuthModal = usePlaygroundStore((s) => s.setShowAuthModal)
  const [dismissed, setDismissed] = useState(false)

  if (!user?.isGuest || guestComparisonCount < GUEST_COMPARISON_LIMIT || dismissed) return null

  return (
    <div className="border-b border-amber-800/50 bg-amber-950/40 px-6 py-2.5 flex items-center justify-between gap-4 text-sm">
      <p className="text-amber-300">
        You&apos;ve used all {GUEST_COMPARISON_LIMIT} free comparisons.{' '}
        <button
          onClick={() => setShowAuthModal(true)}
          className="underline underline-offset-2 font-medium hover:text-amber-200"
        >
          Sign up
        </button>
        {' '}or{' '}
        <button
          onClick={() => setShowAuthModal(true)}
          className="underline underline-offset-2 font-medium hover:text-amber-200"
        >
          log in
        </button>
        {' '}to save unlimited comparisons.
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDismissed(true)}
        className="text-amber-400 hover:text-amber-200 h-6 w-6 p-0 shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} />
      </Button>
    </div>
  )
}
