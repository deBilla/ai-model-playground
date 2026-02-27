'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Trash2, Share2, Check } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { usePlaygroundStore } from '@/lib/store'
import { MODELS, getModel } from '@/lib/models.config'
import type { ComparisonRecord, PaginatedResult } from '@/lib/types'
import MetricsBadge from './MetricsBadge'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const LIMIT = 20

export default function HistoryDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null)
  const history = usePlaygroundStore((s) => s.history)
  const setHistory = usePlaygroundStore((s) => s.setHistory)
  const appendHistory = usePlaygroundStore((s) => s.appendHistory)
  const removeFromHistory = usePlaygroundStore((s) => s.removeFromHistory)
  const setPrompt = usePlaygroundStore((s) => s.setPrompt)
  const setPanelState = usePlaygroundStore((s) => s.setPanelState)
  const user = usePlaygroundStore((s) => s.user)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const triggerButtonRef = useRef<HTMLButtonElement>(null)
  // Ref to track in-flight request so we can abort on cleanup
  const controllerRef = useRef<AbortController | null>(null)

  const fetchPage = useCallback(async (pageNum: number, append = false) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const res = await fetch(`/api/comparisons?page=${pageNum}&limit=${LIMIT}`, { signal: controller.signal })
      if (!res.ok) return
      const result: PaginatedResult<ComparisonRecord> = await res.json()
      if (append) { appendHistory(result.data) } else { setHistory(result.data) }
      setHasMore(result.hasMore)
      setPage(pageNum)
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') console.error('[history fetch]', err)
    }
  }, [appendHistory, setHistory])

  // Refetch page 1 whenever the logged-in user changes (login / logout)
  useEffect(() => {
    setHistory([])
    setPage(1)
    setHasMore(false)
    if (!user) return
    setLoading(true)
    fetchPage(1).finally(() => setLoading(false))
    return () => { controllerRef.current?.abort() }
  }, [fetchPage, user, setHistory])

  const loadMore = async () => {
    setLoadingMore(true)
    await fetchPage(page + 1, true)
    setLoadingMore(false)
  }

  const restoreComparison = (record: ComparisonRecord) => {
    setSelectedId(record.id)
    setPrompt(record.prompt)
    MODELS.forEach(({ id }) => {
      const response = record.responses.find((r) => r.provider === id)
      setPanelState(id, response
        ? { status: 'done', streamedText: response.responseText, error: undefined,
            metrics: { promptTokens: response.promptTokens, completionTokens: response.completionTokens,
              totalTokens: response.totalTokens, estimatedCost: response.estimatedCost,
              latencyMs: response.latencyMs, timeToFirstToken: response.timeToFirstToken,
              tokensPerSecond: response.tokensPerSecond, responseLength: response.responseLength } }
        : { status: 'idle', streamedText: '', error: undefined, metrics: undefined })
    })
    setIsOpen(false)
    setTimeout(() => triggerButtonRef.current?.focus(), 300)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('Delete this comparison?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/comparisons/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (res.ok) { removeFromHistory(id); if (selectedId === id) setSelectedId(null) }
    } catch (err) { console.error('[delete comparison]', err) }
    finally { setDeletingId(null) }
  }

  const handleShare = async (e: React.MouseEvent, record: ComparisonRecord) => {
    e.stopPropagation()
    if (!record.shareToken) return
    const url = `${APP_URL}/share/${record.shareToken}`
    await navigator.clipboard.writeText(url)
    setCopiedShareId(record.id)
    setTimeout(() => setCopiedShareId(null), 2000)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <button ref={triggerButtonRef} onClick={() => setIsOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors px-2 py-4 rounded-l-lg shadow-xl border border-neutral-700 border-r-0"
        style={{ writingMode: 'vertical-rl' }} aria-label="Open comparison history"
        aria-expanded={isOpen} aria-controls="history-drawer">
        <span className="text-xs font-semibold tracking-widest uppercase rotate-180 block">
          History {history.length > 0 ? `(${history.length})` : ''}
        </span>
      </button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent id="history-drawer" side="right"
          className="w-full sm:max-w-80 bg-neutral-900 border-l border-neutral-700 p-0 flex flex-col">
          <SheetHeader className="px-4 py-4 border-b border-neutral-700 flex-shrink-0">
            <SheetTitle className="text-neutral-100">Comparison History</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-24 bg-neutral-800" />
                    <Skeleton className="h-4 w-full bg-neutral-800" />
                    <Skeleton className="h-4 w-3/4 bg-neutral-800" />
                  </div>
                ))}
              </div>
            )}

            {!loading && !user && (
              <div className="flex items-center justify-center h-32 text-neutral-500 text-sm text-center px-4">
                Sign in to view your comparison history.
              </div>
            )}

            {!loading && user && history.length === 0 && (
              <div className="flex items-center justify-center h-32 text-neutral-500 text-sm text-center px-4">
                No comparisons yet. Run your first prompt!
              </div>
            )}

            {!loading && history.map((record, idx) => (
              <div key={record.id}>
                {idx > 0 && <Separator className="bg-neutral-800" />}
                <div className={`relative px-4 py-4 hover:bg-neutral-800 transition-colors ${selectedId === record.id ? 'bg-neutral-800' : ''}`}>
                  <button onClick={() => restoreComparison(record)} className="w-full text-left pr-16 focus:outline-none focus:bg-neutral-800">
                    <p className="text-xs text-neutral-500 mb-1">{formatDate(record.createdAt)}</p>
                    <p className="text-sm text-neutral-200 line-clamp-2 mb-2">{record.prompt}</p>
                    <div className="flex flex-wrap gap-1.5 text-xs mb-2">
                      {record.responses.map((r) => {
                        const cfg = getModel(r.provider)
                        return <Badge key={r.provider} variant="outline" className={`${cfg?.textColor ?? 'text-neutral-400'} border-neutral-700 font-mono text-xs py-0`}>{r.label}</Badge>
                      })}
                    </div>
                    {record.responses.length > 0 && (
                      <MetricsBadge
                        promptTokens={record.responses.reduce((a, r) => a + r.promptTokens, 0)}
                        completionTokens={record.responses.reduce((a, r) => a + r.completionTokens, 0)}
                        totalTokens={record.responses.reduce((a, r) => a + r.totalTokens, 0)}
                        estimatedCost={record.responses.reduce((a, r) => a + r.estimatedCost, 0)}
                        latencyMs={Math.max(...record.responses.map((r) => r.latencyMs))}
                      />
                    )}
                  </button>
                  <div className="absolute top-3 right-3 flex gap-1">
                    {record.shareToken && (
                      <Button size="icon" variant="ghost" onClick={(e) => handleShare(e, record)}
                        aria-label="Copy share link" className="h-6 w-6 text-neutral-500 hover:text-sky-400">
                        {copiedShareId === record.id ? <Check size={13} /> : <Share2 size={13} />}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" disabled={deletingId === record.id}
                      onClick={(e) => handleDelete(e, record.id)}
                      aria-label={`Delete: ${record.prompt.slice(0, 40)}`}
                      className="h-6 w-6 text-neutral-500 hover:text-red-400">
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {hasMore && !loading && (
              <div className="p-4">
                <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore} className="w-full border-neutral-700 text-neutral-400 hover:text-white">
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
