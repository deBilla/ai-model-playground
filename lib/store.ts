'use client'

import { create } from 'zustand'
import { MODELS } from './models.config'
import type { ProviderId } from './models.config'
import { PanelState, ComparisonRecord, User } from './types'

const initialPanelState: PanelState = {
  status: 'idle',
  streamedText: '',
  metrics: undefined,
  error: undefined,
  isRateLimit: false,
}

type Panels = Record<ProviderId, PanelState>

function makeInitialPanels(): Panels {
  return Object.fromEntries(
    MODELS.map((m) => [m.id, { ...initialPanelState }]),
  ) as Panels
}

interface ChatSettings {
  temperature: number
  maxTokens: number
}

interface PlaygroundStore {
  prompt: string
  setPrompt: (p: string) => void

  panels: Panels
  setPanelState: (provider: ProviderId, state: Partial<PanelState>) => void
  resetPanels: () => void

  history: ComparisonRecord[]
  setHistory: (h: ComparisonRecord[]) => void
  addToHistory: (c: ComparisonRecord) => void
  appendHistory: (items: ComparisonRecord[]) => void
  removeFromHistory: (id: string) => void

  user: User | null
  setUser: (u: User) => void
  clearUser: () => void

  guestComparisonCount: number
  setGuestComparisonCount: (n: number) => void

  showAuthModal: boolean
  setShowAuthModal: (show: boolean) => void

  chatSettings: ChatSettings
  setChatSettings: (s: Partial<ChatSettings>) => void

  isAnyLoading: () => boolean
}

export const usePlaygroundStore = create<PlaygroundStore>((set, get) => ({
  prompt: '',
  setPrompt: (p) => set({ prompt: p }),

  panels: makeInitialPanels(),

  setPanelState: (provider, state) =>
    set((prev) => ({
      panels: {
        ...prev.panels,
        [provider]: { ...prev.panels[provider], ...state },
      },
    })),

  resetPanels: () => set({ panels: makeInitialPanels() }),

  history: [],
  setHistory: (h) => set({ history: h }),
  addToHistory: (c) => set((prev) => ({ history: [c, ...prev.history] })),
  appendHistory: (items) =>
    set((prev) => ({
      history: [...prev.history, ...items.filter((i) => !prev.history.some((h) => h.id === i.id))],
    })),
  removeFromHistory: (id) =>
    set((prev) => ({ history: prev.history.filter((h) => h.id !== id) })),

  user: null,
  setUser: (u) => set({ user: u }),
  clearUser: () => set({ user: null }),

  guestComparisonCount: 0,
  setGuestComparisonCount: (n) => set({ guestComparisonCount: n }),

  showAuthModal: false,
  setShowAuthModal: (show) => set({ showAuthModal: show }),

  chatSettings: { temperature: 1.0, maxTokens: 2048 },
  setChatSettings: (s) =>
    set((prev) => ({ chatSettings: { ...prev.chatSettings, ...s } })),

  isAnyLoading: () => {
    const { panels } = get()
    return Object.values(panels).some(
      (p) => p.status === 'loading' || p.status === 'streaming',
    )
  },
}))
