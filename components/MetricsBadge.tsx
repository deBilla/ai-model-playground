'use client'

import { memo } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCost } from '@/lib/models.config'

interface MetricsBadgeProps {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
  latencyMs: number
  timeToFirstToken?: number
  tokensPerSecond?: number
}

function formatMs(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

function Pill({ children, tooltip, color = 'text-neutral-300' }: {
  children: React.ReactNode
  tooltip: string
  color?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-0.5 font-mono text-xs cursor-default select-none ${color}`}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

const MetricsBadge = memo(function MetricsBadge({
  promptTokens,
  completionTokens,
  totalTokens,
  estimatedCost,
  latencyMs,
  timeToFirstToken,
  tokensPerSecond,
}: MetricsBadgeProps) {
  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1.5 pt-2.5 border-t border-neutral-700/60">
        <Pill tooltip={`${promptTokens.toLocaleString()} prompt + ${completionTokens.toLocaleString()} completion`}>
          {totalTokens.toLocaleString()} tok
        </Pill>

        <Pill tooltip="Estimated cost" color="text-emerald-400">
          {formatCost(estimatedCost)}
        </Pill>

        <Pill tooltip="Total latency" color="text-sky-400">
          {formatMs(latencyMs)}
        </Pill>

        {timeToFirstToken != null && timeToFirstToken > 0 && (
          <Pill tooltip="Time to first token" color="text-violet-400">
            TTFT {formatMs(timeToFirstToken)}
          </Pill>
        )}

        {tokensPerSecond != null && tokensPerSecond > 0 && (
          <Pill tooltip="Tokens per second" color="text-amber-400">
            {tokensPerSecond.toFixed(1)} tok/s
          </Pill>
        )}
      </div>
    </TooltipProvider>
  )
})

export default MetricsBadge
