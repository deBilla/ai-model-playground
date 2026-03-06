'use client'

import { useRef, useState, useCallback } from 'react'
import { MODELS } from '@/lib/models.config'
import type { ProviderId } from '@/lib/models.config'
import { usePlaygroundStore } from '@/lib/store'
import type { ModelResult } from '@/lib/types'
import ModelPanel from './ModelPanel'
import MetricsComparison from './MetricsComparison'

export default function CompareLayout() {
  const [syncScrollEnabled, setSyncScrollEnabled] = useState(false)
  const syncScrollEnabledRef = useRef(false)
  const panels = usePlaygroundStore((s) => s.panels)
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>(
    Object.fromEntries(MODELS.map((m) => [m.id, null])),
  )
  const isScrolling = useRef(false)

  const toggleSync = useCallback(() => {
    setSyncScrollEnabled((v) => {
      syncScrollEnabledRef.current = !v
      return !v
    })
  }, [])

  // Stable handler — reads syncScrollEnabledRef so it never goes stale
  // even though el.onscroll is assigned only once on mount.
  const handleScroll = useCallback(
    (source: ProviderId) => () => {
      if (!syncScrollEnabledRef.current || isScrolling.current) return
      const sourceEl = panelRefs.current[source]
      if (!sourceEl) return
      const scrollTop = sourceEl.scrollTop
      isScrolling.current = true
      MODELS.forEach(({ id }) => {
        if (id !== source) {
          const el = panelRefs.current[id]
          if (el) el.scrollTop = scrollTop
        }
      })
      requestAnimationFrame(() => { isScrolling.current = false })
    },
    [],
  )

  const handleSwitchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleSync() }
  }

  // Collect completed results for MetricsComparison
  const allDone = MODELS.every(({ id }) => panels[id]?.status === 'done')
  const completedResults: ModelResult[] = allDone
    ? MODELS.flatMap(({ id }) => {
        const p = panels[id]
        if (p?.status !== 'done' || !p.metrics || !p.streamedText) return []
        const model = MODELS.find((m) => m.id === id)
        return [{
          provider: id as ProviderId,
          label: model?.label ?? id,
          responseText: p.streamedText,
          promptTokens: p.metrics.promptTokens,
          completionTokens: p.metrics.completionTokens,
          totalTokens: p.metrics.totalTokens,
          estimatedCost: p.metrics.estimatedCost,
          latencyMs: p.metrics.latencyMs,
          timeToFirstToken: p.metrics.timeToFirstToken,
          tokensPerSecond: p.metrics.tokensPerSecond,
          responseLength: p.metrics.responseLength,
        }]
      })
    : []

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Sync Scroll toggle */}
      <div className="flex justify-end">
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-neutral-400">
          <span id="sync-scroll-label">Sync Scroll</span>
          <div
            role="switch"
            aria-checked={syncScrollEnabled}
            aria-labelledby="sync-scroll-label"
            tabIndex={0}
            onClick={toggleSync}
            onKeyDown={handleSwitchKeyDown}
            className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-neutral-950 ${syncScrollEnabled ? 'bg-sky-600' : 'bg-neutral-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${syncScrollEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
        </label>
      </div>

      {/* Auto-fit grid */}
      <div className="grid gap-4 flex-1 min-h-0"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
        {MODELS.map(({ id, label, color }) => (
          <ModelPanel key={id} provider={id} label={label} color={color}
            ref={(el) => {
              panelRefs.current[id] = el
              if (el) el.onscroll = handleScroll(id)
            }}
          />
        ))}
      </div>

      {/* Metrics comparison — shown only when all panels have completed */}
      {completedResults.length >= 2 && (
        <MetricsComparison results={completedResults} />
      )}
    </div>
  )
}
