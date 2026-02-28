'use client'

import { useCallback, useRef } from 'react'
import { usePlaygroundStore } from '@/lib/store'
import { MODELS } from '@/lib/models.config'
import type { ProviderId } from '@/lib/models.config'
import type { ModelResult, ComparisonRecord } from '@/lib/types'
import { streamProvider, abortAllProviders } from '@/lib/streamProvider'

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

      // Fire all model streams independently and in parallel.
      const settled = await Promise.allSettled(
        MODELS.map((model) =>
          streamProvider(model.id as ProviderId, prompt, setPanelState, settings),
        ),
      )

      isRunning.current = false

      const successfulResponses: ModelResult[] = settled
        .filter(
          (r): r is PromiseFulfilledResult<ModelResult> =>
            r.status === 'fulfilled' && r.value !== null,
        )
        .map((r) => r.value)

      if (successfulResponses.length === 0) return

      try {
        const res = await fetch('/api/comparisons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, responses: successfulResponses }),
        })
        if (res.ok) {
          const record: ComparisonRecord = await res.json()
          addToHistory(record)
          if (user?.isGuest) {
            setGuestComparisonCount(guestComparisonCount + 1)
          }
        } else if (res.status === 403) {
          const data = await res.json().catch(() => ({}))
          if ((data as { limitReached?: boolean }).limitReached) {
            setShowAuthModal(true)
          }
        }
      } catch (err) {
        console.error('[save comparison]', err)
      }
    },
    [setPanelState, resetPanels, addToHistory, chatSettings, user, guestComparisonCount, setGuestComparisonCount, setShowAuthModal],
  )

  const stop = useCallback(() => {
    abortAllProviders()
    isRunning.current = false
  }, [])

  return { run, stop }
}
