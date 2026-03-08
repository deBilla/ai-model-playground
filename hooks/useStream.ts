'use client'

import { useCallback, useRef } from 'react'
import { usePlaygroundStore } from '@/lib/store'
import { consumeMultiplexedStream, abortCompareStream } from '@/lib/compareStream'

export function useStream() {
  const setPanelState = usePlaygroundStore((s) => s.setPanelState)
  const resetPanels = usePlaygroundStore((s) => s.resetPanels)
  const addToHistory = usePlaygroundStore((s) => s.addToHistory)
  const chatSettings = usePlaygroundStore((s) => s.chatSettings)
  const user = usePlaygroundStore((s) => s.user)
  const guestComparisonCount = usePlaygroundStore((s) => s.guestComparisonCount)
  const setGuestComparisonCount = usePlaygroundStore((s) => s.setGuestComparisonCount)
  const setShowAuthModal = usePlaygroundStore((s) => s.setShowAuthModal)
  const isRunning = useRef(false)

  const run = useCallback(
    async (prompt: string) => {
      if (isRunning.current) return
      isRunning.current = true
      resetPanels()

      // Snapshot settings at the time the run starts so all panels use the same values.
      const settings = { temperature: chatSettings.temperature, maxTokens: chatSettings.maxTokens }

      // Single multiplexed stream: backend fans out to all models concurrently and persists the result.
      const { savedRecord, limitReached } = await consumeMultiplexedStream(prompt, setPanelState, settings)

      isRunning.current = false

      if (limitReached) {
        resetPanels()
        setShowAuthModal(true)
        return
      }

      if (savedRecord) {
        addToHistory(savedRecord)
        if (user?.isGuest) {
          setGuestComparisonCount(guestComparisonCount + 1)
        }
      }
    },
    [setPanelState, resetPanels, addToHistory, chatSettings, user, guestComparisonCount, setGuestComparisonCount, setShowAuthModal],
  )

  const stop = useCallback(() => {
    abortCompareStream()
    isRunning.current = false
  }, [])

  return { run, stop }
}
