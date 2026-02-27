import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { historyService } from '@/lib/modules/history'
import { MODELS } from '@/lib/models.config'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import MetricsComparison from '@/components/MetricsComparison'
import MetricsBadge from '@/components/MetricsBadge'

export const dynamic = 'force-dynamic'

interface Props {
  params: { token: string }
}

export default async function SharePage({ params }: Props) {
  const comparison = await historyService.getByShareToken(params.token)
  if (!comparison) notFound()

  const modelColors: Record<string, string> = Object.fromEntries(
    MODELS.map((m) => [m.id, m.color]),
  )

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">AI Model Playground</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Shared comparison</p>
        </div>
        <Button asChild variant="outline" size="sm" className="border-neutral-700 text-neutral-300 hover:text-white gap-1.5">
          <Link href="/">
            Try it yourself <ExternalLink size={13} />
          </Link>
        </Button>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Prompt */}
        <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-4">
          <p className="text-xs text-neutral-500 mb-2 uppercase tracking-wider font-semibold">Prompt</p>
          <p className="text-neutral-100">{comparison.prompt}</p>
          <p className="text-xs text-neutral-600 mt-2">
            {new Date(comparison.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Responses */}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
          {comparison.responses.map((r) => (
            <div key={r.provider} className="flex flex-col bg-neutral-900 rounded-xl border border-neutral-700 overflow-hidden shadow-lg">
              <div className={`flex items-center justify-between px-4 py-3 border-b border-neutral-700 ${modelColors[r.provider] ?? 'bg-neutral-800'}`}>
                <span className="font-semibold text-sm text-white">{r.label}</span>
                <Badge variant="outline" className="text-white/90 border-white/20 text-xs">Read-only</Badge>
              </div>
              <div className="flex-1 p-4 text-sm text-neutral-200 leading-relaxed overflow-y-auto max-h-96">
                <p className="whitespace-pre-wrap break-words">{r.responseText}</p>
              </div>
              <div className="px-4 pb-4">
                <MetricsBadge
                  promptTokens={r.promptTokens}
                  completionTokens={r.completionTokens}
                  totalTokens={r.totalTokens}
                  estimatedCost={r.estimatedCost}
                  latencyMs={r.latencyMs}
                  timeToFirstToken={r.timeToFirstToken}
                  tokensPerSecond={r.tokensPerSecond}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Metrics comparison */}
        {comparison.responses.length >= 2 && (
          <MetricsComparison results={comparison.responses} />
        )}
      </main>
    </div>
  )
}
