'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
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
      <div className="flex flex-wrap gap-1.5 pt-3 border-t border-neutral-700">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="font-mono cursor-default">
              {totalTokens.toLocaleString()} tok
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {promptTokens} prompt + {completionTokens} completion
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="font-mono cursor-default text-emerald-400">
              {formatCost(estimatedCost)}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Estimated cost</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="font-mono cursor-default text-sky-400">
              {formatMs(latencyMs)}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Total latency</TooltipContent>
        </Tooltip>

        {timeToFirstToken != null && timeToFirstToken > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="font-mono cursor-default text-violet-400">
                TTFT {formatMs(timeToFirstToken)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Time to first token</TooltipContent>
          </Tooltip>
        )}

        {tokensPerSecond != null && tokensPerSecond > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="font-mono cursor-default text-amber-400">
                {tokensPerSecond.toFixed(1)} tok/s
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Tokens per second</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
})

export default MetricsBadge
