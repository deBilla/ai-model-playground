'use client'

import { MODELS } from '@/lib/models.config'
import type { ProviderId } from '@/lib/models.config'
import { usePlaygroundStore } from '@/lib/store'
import type { ModelResult } from '@/lib/types'
import ModelPanel from './ModelPanel'
import MetricsComparison from './MetricsComparison'

export default function CompareLayout() {
  const panels = usePlaygroundStore((s) => s.panels)

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
      <div className="grid gap-4 flex-1 min-h-0"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
        {MODELS.map(({ id, label, color }) => (
          <ModelPanel key={id} provider={id} label={label} color={color} />
        ))}
      </div>

      {completedResults.length >= 2 && (
        <MetricsComparison results={completedResults} />
      )}
    </div>
  )
}
