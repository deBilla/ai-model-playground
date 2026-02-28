'use client'

import { memo, useMemo } from 'react'
import { CheckCircle } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatCost } from '@/lib/models.config'
import type { ModelResult } from '@/lib/types'

interface MetricsComparisonProps {
  results: ModelResult[]
}

type Metric = {
  key: keyof ModelResult
  label: string
  format: (v: number) => string
  winner: 'min' | 'max' | 'info'
}

const METRICS: Metric[] = [
  { key: 'latencyMs',        label: 'Latency',        format: (v) => v < 1000 ? `${v}ms` : `${(v/1000).toFixed(2)}s`, winner: 'min' },
  { key: 'timeToFirstToken', label: 'Time to First',  format: (v) => v < 1000 ? `${v}ms` : `${(v/1000).toFixed(2)}s`, winner: 'min' },
  { key: 'tokensPerSecond',  label: 'Tokens/sec',     format: (v) => v.toFixed(1),                                      winner: 'max' },
  { key: 'promptTokens',     label: 'Prompt Tokens',  format: (v) => v.toLocaleString(),                                winner: 'info' },
  { key: 'completionTokens', label: 'Output Tokens',  format: (v) => v.toLocaleString(),                                winner: 'info' },
  { key: 'totalTokens',      label: 'Total Tokens',   format: (v) => v.toLocaleString(),                                winner: 'info' }, 
  { key: 'estimatedCost',    label: 'Cost',           format: formatCost,                                               winner: 'min' },
  { key: 'responseLength',   label: 'Response Length',format: (v) => `${v.toLocaleString()} chars`,                    winner: 'info' },
]

const MetricsComparison = memo(function MetricsComparison({ results }: MetricsComparisonProps) {
  const winners = useMemo(() => {
    return METRICS.reduce<Record<string, string | null>>((acc, metric) => {
      if (metric.winner === 'info' || results.length < 2) {
        acc[metric.key] = null
        return acc
      }
      const vals = results.map((r) => ({ id: r.provider, v: r[metric.key] as number }))
      const valid = vals.filter((x) => x.v > 0)
      if (valid.length < 2) { acc[metric.key] = null; return acc }
      const best = metric.winner === 'min'
        ? valid.reduce((a, b) => (a.v < b.v ? a : b))
        : valid.reduce((a, b) => (a.v > b.v ? a : b))
      // Only highlight if the winner is meaningfully better (>5% difference)
      const vals2 = valid.map((x) => x.v)
      const range = Math.max(...vals2) - Math.min(...vals2)
      const pct = range / (metric.winner === 'min' ? Math.min(...vals2) : Math.max(...vals2))
      acc[metric.key] = pct > 0.05 ? best.id : null
      return acc
    }, {})
  }, [results])

  return (
    <div className="mt-4">
      <Separator className="mb-4 bg-neutral-800" />
      <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
        Performance Comparison
      </h3>
      <div className="rounded-xl border border-neutral-700 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-neutral-700 hover:bg-transparent">
              <TableHead className="text-neutral-400 w-36">Metric</TableHead>
              {results.map((r) => (
                <TableHead key={r.provider} className="text-neutral-300 font-semibold">
                  {r.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {METRICS.map((metric) => (
              <TableRow key={metric.key} className="border-neutral-800 hover:bg-neutral-800/50">
                <TableCell className="text-neutral-400 text-xs font-medium">
                  {metric.label}
                </TableCell>
                {results.map((r) => {
                  const val = r[metric.key] as number
                  const isWinner = winners[metric.key] === r.provider
                  return (
                    <TableCell key={r.provider}
                      className={isWinner ? 'text-emerald-400 font-semibold' : 'text-neutral-300'}>
                      <span className="flex items-center gap-1.5 font-mono text-xs">
                        {metric.format(val)}
                        {isWinner && (
                          <Badge variant="outline" className="border-emerald-500 text-emerald-400 py-0 px-1 text-xs">
                            <CheckCircle size={10} className="mr-0.5" />best
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
})

export default MetricsComparison
