'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Trash2, Share2, Check, Clock } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlaygroundStore } from '@/lib/store'
import { MODELS, getModel, formatCost } from '@/lib/models.config'
import type { ComparisonRecord, PaginatedResult } from '@/lib/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const LIMIT = 20

function formatMs(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Individual history card ─────────────────────────────────────────────────

function HistoryCard({
  record,
  isSelected,
  isDeleting,
  isCopied,
  onRestore,
  onDelete,
  onShare,
}: {
  record: ComparisonRecord
  isSelected: boolean
  isDeleting: boolean
  isCopied: boolean
  onRestore: () => void
  onDelete: (e: React.MouseEvent) => void
  onShare: (e: React.MouseEvent) => void
}) {
  const totalTokens = record.responses.reduce((a, r) => a + r.totalTokens, 0)
  const totalCost   = record.responses.reduce((a, r) => a + r.estimatedCost, 0)
  const maxLatency  = record.responses.length > 0 ? Math.max(...record.responses.map((r) => r.latencyMs)) : 0

  return (
    <div className={`relative group border-b border-neutral-800 transition-colors ${isSelected ? 'bg-neutral-800/70' : 'hover:bg-neutral-800/40'}`}>
      {/* Selected accent */}
      {isSelected && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-sky-500" />}

      <button
        onClick={onRestore}
        className="w-full text-left px-4 py-3.5 pr-16 focus:outline-none"
      >
        {/* Date row */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <Clock size={11} className="text-neutral-500 shrink-0" />
          <span className="text-xs text-neutral-400">{formatDate(record.createdAt)}</span>
        </div>

        {/* Prompt */}
        <p className="text-sm text-neutral-100 leading-snug line-clamp-2 mb-2.5">
          {record.prompt}
        </p>

        {/* Provider tags */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {record.responses.map((r) => {
            const cfg = getModel(r.provider)
            return (
              <span
                key={r.provider}
                className={`inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs font-medium ${cfg?.textColor ?? 'text-neutral-400'}`}
              >
                {r.label}
              </span>
            )
          })}
        </div>

        {/* Metrics row */}
        {record.responses.length > 0 && (
          <div className="flex items-center gap-3 pt-2 border-t border-neutral-700/60">
            <span className="text-xs font-mono text-neutral-300">
              {totalTokens.toLocaleString()} tok
            </span>
            <span className="text-xs font-mono text-emerald-400">
              {formatCost(totalCost)}
            </span>
            <span className="text-xs font-mono text-sky-400">
              {formatMs(maxLatency)}
            </span>
          </div>
        )}
      </button>

      {/* Action buttons — visible on hover or when active */}
      <div className={`absolute top-3 right-3 flex gap-0.5 transition-opacity ${isCopied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {record.shareToken && (
          <Button
            size="icon" variant="ghost"
            onClick={onShare}
            aria-label="Copy share link"
            className={`h-7 w-7 hover:bg-neutral-700 transition-colors ${isCopied ? 'text-emerald-400' : 'text-neutral-500 hover:text-sky-400'}`}
          >
            {isCopied ? <Check size={13} /> : <Share2 size={13} />}
          </Button>
        )}
        <Button
          size="icon" variant="ghost"
          disabled={isDeleting}
          onClick={onDelete}
          aria-label={`Delete: ${record.prompt.slice(0, 40)}`}
          className="h-7 w-7 text-neutral-500 hover:text-red-400 hover:bg-neutral-700"
        >
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  )
}

// ─── Drawer ──────────────────────────────────────────────────────────────────

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

  return (
    <>
      {/* Sidebar tab trigger */}
      <button
        ref={triggerButtonRef}
        onClick={() => setIsOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors px-2 py-4 rounded-l-lg shadow-xl border border-neutral-700 border-r-0"
        style={{ writingMode: 'vertical-rl' }}
        aria-label="Open comparison history"
        aria-expanded={isOpen}
        aria-controls="history-drawer"
      >
        <span className="text-xs font-semibold tracking-widest uppercase rotate-180 block">
          History {history.length > 0 ? `(${history.length})` : ''}
        </span>
      </button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          id="history-drawer"
          side="right"
          className="w-full sm:max-w-[340px] bg-neutral-900 border-l border-neutral-700 p-0 flex flex-col"
        >
          {/* Copied toast */}
          {copiedShareId && (
            <div className="absolute bottom-5 inset-x-4 z-20 flex items-center gap-2.5 rounded-lg border border-emerald-800/70 bg-emerald-950 px-4 py-2.5 shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
              <Check size={14} className="text-emerald-400 shrink-0" />
              <span className="text-sm text-emerald-300">Share link copied to clipboard</span>
            </div>
          )}

          <SheetHeader className="px-4 py-3.5 border-b border-neutral-700 flex-shrink-0">
            <SheetTitle className="text-neutral-100 text-sm font-semibold">
              Comparison History
              {history.length > 0 && (
                <span className="ml-2 text-xs font-normal text-neutral-500">
                  {history.length} saved
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Loading skeletons */}
            {loading && (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-28 bg-neutral-800" />
                    <Skeleton className="h-4 w-full bg-neutral-800" />
                    <Skeleton className="h-4 w-3/4 bg-neutral-800" />
                    <Skeleton className="h-3 w-1/2 bg-neutral-800" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty states */}
            {!loading && !user && (
              <div className="flex items-center justify-center h-32 text-neutral-500 text-sm text-center px-6">
                Sign in to view your comparison history.
              </div>
            )}
            {!loading && user && history.length === 0 && (
              <div className="flex items-center justify-center h-32 text-neutral-500 text-sm text-center px-6">
                No comparisons yet. Run your first prompt!
              </div>
            )}

            {/* History cards */}
            {!loading && history.map((record) => (
              <HistoryCard
                key={record.id}
                record={record}
                isSelected={selectedId === record.id}
                isDeleting={deletingId === record.id}
                isCopied={copiedShareId === record.id}
                onRestore={() => restoreComparison(record)}
                onDelete={(e) => handleDelete(e, record.id)}
                onShare={(e) => handleShare(e, record)}
              />
            ))}

            {/* Load more */}
            {hasMore && !loading && (
              <div className="p-4">
                <Button
                  variant="outline" size="sm"
                  onClick={loadMore} disabled={loadingMore}
                  className="w-full border-neutral-700 bg-transparent text-neutral-400 hover:text-white hover:bg-neutral-800 hover:border-neutral-600"
                >
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
