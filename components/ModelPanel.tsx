'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePlaygroundStore } from '@/lib/store'
import type { ProviderId } from '@/lib/models.config'
import MetricsBadge from './MetricsBadge'

interface ModelPanelProps {
  provider: ProviderId
  label: string
  color: string
}

const statusColors: Record<string, string> = {
  idle: 'bg-neutral-600',
  loading: 'bg-amber-500 animate-pulse',
  streaming: 'bg-sky-500 animate-pulse',
  done: 'bg-emerald-500',
  error: 'bg-red-500',
}

const statusLabels: Record<string, string> = {
  idle: 'Idle',
  loading: 'Loading',
  streaming: 'Streaming',
  done: 'Done',
  error: 'Error',
}

export default function ModelPanel({ provider, label, color }: ModelPanelProps) {
  const panel = usePlaygroundStore((s) => s.panels[provider])
  const { status, streamedText, metrics, error, isRateLimit } = panel
  const isActive = status === 'loading' || status === 'streaming'
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!streamedText) return
    navigator.clipboard.writeText(streamedText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="flex flex-col h-full bg-neutral-900 rounded-xl border border-neutral-700 overflow-hidden shadow-lg"
      aria-label={`${label} response panel`}
      aria-busy={isActive}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-neutral-700 ${color}`}>
        <span className="font-semibold text-sm tracking-wide text-white truncate">{label}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {status === 'done' && streamedText && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCopy}
              aria-label={copied ? 'Copied' : `Copy ${label} response`}
              className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </Button>
          )}
          <Badge variant="outline" className="text-white/70 border-white/20 text-xs uppercase tracking-wider">
            {statusLabels[status] ?? status}
          </Badge>
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColors[status] ?? statusColors.idle}`}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Body */}
      <div
        role="status"
        aria-live="polite"
        aria-label={`${label} response`}
        className="flex-1 overflow-y-auto p-4 text-sm text-neutral-200 leading-relaxed"
      >
        {status === 'loading' && (
          <div className="space-y-2" aria-label="Loading response">
            {[80, 60, 90, 50, 70].map((w, i) => (
              <Skeleton key={i} className="h-3 bg-neutral-700" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {status === 'streaming' && streamedText && (
          <p className="whitespace-pre-wrap break-words font-mono">
            {streamedText}
            <span className="inline-block w-2 h-4 ml-0.5 bg-sky-400 animate-blink align-text-bottom" aria-hidden="true" />
          </p>
        )}

        {status === 'done' && streamedText && (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className ?? '')
                  return match ? (
                    <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div"
                      customStyle={{ borderRadius: '0.5rem', margin: '0.75rem 0', fontSize: '0.8rem' }}>
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className="bg-neutral-800 text-sky-300 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                      {children}
                    </code>
                  )
                },
              }}
            >
              {streamedText}
            </ReactMarkdown>
          </div>
        )}

        {status === 'error' && (
          <Alert variant={isRateLimit ? 'default' : 'destructive'}
            className={isRateLimit ? 'border-amber-500 text-amber-400' : ''}>
            <AlertTriangle size={16} />
            <AlertTitle>{isRateLimit ? 'Rate Limited' : 'Error'}</AlertTitle>
            <AlertDescription className="text-sm opacity-80">{error}</AlertDescription>
          </Alert>
        )}

        {status === 'idle' && (
          <p className="text-neutral-500 text-sm italic">
            Enter a prompt and click Compare to see the response.
          </p>
        )}
      </div>

      {status === 'done' && metrics && (
        <div className="px-4 pb-4">
          <MetricsBadge
            promptTokens={metrics.promptTokens}
            completionTokens={metrics.completionTokens}
            totalTokens={metrics.totalTokens}
            estimatedCost={metrics.estimatedCost}
            latencyMs={metrics.latencyMs}
            timeToFirstToken={metrics.timeToFirstToken}
            tokensPerSecond={metrics.tokensPerSecond}
          />
        </div>
      )}
    </div>
  )
}
