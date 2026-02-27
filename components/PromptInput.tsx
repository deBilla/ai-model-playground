'use client'

import { useId, useRef, useCallback, useState } from 'react'
import { Square, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { usePlaygroundStore } from '@/lib/store'

interface PromptInputProps {
  onSubmit: (prompt: string) => void
  onStop: () => void
}

export default function PromptInput({ onSubmit, onStop }: PromptInputProps) {
  const prompt = usePlaygroundStore((s) => s.prompt)
  const setPrompt = usePlaygroundStore((s) => s.setPrompt)
  const isAnyLoading = usePlaygroundStore((s) => s.isAnyLoading)
  const chatSettings = usePlaygroundStore((s) => s.chatSettings)
  const setChatSettings = usePlaygroundStore((s) => s.setChatSettings)
  const loading = isAnyLoading()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const textareaId = useId()
  const [showSettings, setShowSettings] = useState(false)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20
    el.style.height = `${Math.min(Math.max(el.scrollHeight, lineHeight * 4), lineHeight * 10)}px`
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)
    adjustHeight()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !loading && prompt.trim()) {
      e.preventDefault()
      onSubmit(prompt.trim())
    }
  }

  return (
    <div className="w-full space-y-3">
      <div className="relative">
        <label htmlFor={textareaId} className="sr-only">Prompt</label>
        <Textarea
          id={textareaId}
          ref={textareaRef}
          value={prompt}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter your prompt… (⌘ + Enter to submit)"
          rows={4}
          disabled={loading}
          aria-disabled={loading}
          style={{ resize: 'none', overflowY: 'auto' }}
          className="bg-neutral-900 border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:ring-sky-500 disabled:opacity-50"
        />
        {loading && (
          <div className="absolute top-3 right-3 flex items-center gap-2 text-xs text-sky-400"
            aria-live="polite" aria-label="Streaming responses">
            <span className="inline-block w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            Streaming…
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400" aria-live="polite">
            {prompt.length > 0 ? `${prompt.length} characters` : 'All models run in parallel'}
          </span>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            aria-expanded={showSettings}
            aria-controls="settings-panel"
          >
            <SlidersHorizontal size={13} aria-hidden="true" />
            Settings
            <ChevronDown
              size={12}
              className={`transition-transform duration-200 ${showSettings ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {loading && (
            <Button onClick={onStop} variant="destructive" size="sm" aria-label="Stop all streams"
              className="flex items-center gap-1.5">
              <Square size={14} aria-hidden="true" /> Stop
            </Button>
          )}
          <Button onClick={() => !loading && prompt.trim() && onSubmit(prompt.trim())}
            disabled={loading || !prompt.trim()}
            className="flex-1 sm:flex-none bg-sky-600 hover:bg-sky-500 active:bg-sky-700">
            {loading ? 'Running…' : 'Compare Models'}
          </Button>
        </div>
      </div>

      {showSettings && (
        <div
          id="settings-panel"
          className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 space-y-4"
          role="region"
          aria-label="Generation settings"
        >
          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-neutral-300">Temperature</label>
              <span className="text-xs font-mono text-neutral-400">{chatSettings.temperature.toFixed(2)}</span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.01}
              value={[chatSettings.temperature]}
              onValueChange={([v]) => setChatSettings({ temperature: v })}
              aria-label="Temperature"
            />
            <div className="flex justify-between text-xs text-neutral-600 mt-1.5">
              <span>0 — Precise</span>
              <span>1 — Balanced</span>
              <span>2 — Creative</span>
            </div>
          </div>

          <Separator className="bg-neutral-800" />

          {/* Max tokens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-neutral-300">Max Tokens</label>
              <span className="text-xs font-mono text-neutral-400">{chatSettings.maxTokens.toLocaleString()}</span>
            </div>
            <Slider
              min={256}
              max={4096}
              step={64}
              value={[chatSettings.maxTokens]}
              onValueChange={([v]) => setChatSettings({ maxTokens: v })}
              aria-label="Max tokens"
            />
            <div className="flex justify-between text-xs text-neutral-600 mt-1.5">
              <span>256</span>
              <span>4,096</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
