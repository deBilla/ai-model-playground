import type { ProviderId } from './models.config'

export type User = {
  id: string
  email: string | null
  name: string | null
  isGuest: boolean
  createdAt: string
}

export type ModelResult = {
  provider: ProviderId
  label: string
  responseText: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
  latencyMs: number
  timeToFirstToken: number
  tokensPerSecond: number
  responseLength: number
  error?: string
}

export type ComparisonRecord = {
  id: string
  prompt: string
  createdAt: string
  shareToken?: string | null
  responses: ModelResult[]
}

export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export type PanelState = {
  status: 'idle' | 'loading' | 'streaming' | 'done' | 'error'
  streamedText: string
  metrics?: Omit<ModelResult, 'provider' | 'label' | 'responseText' | 'error'>
  error?: string
  isRateLimit?: boolean
}
