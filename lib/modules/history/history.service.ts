import { getModel, isValidProviderId } from '@/lib/models.config'
import type { ModelResult, ComparisonRecord, PaginatedResult } from '@/lib/types'
import type { HistoryRepository } from './history.repository'
import type { CreateComparisonDto } from './history.dto'
import { GUEST_COMPARISON_LIMIT } from '@/lib/constants'

type DbResponse = {
  provider: string
  label: string
  responseText: string
  metrics: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    estimatedCost: number
    latencyMs: number
    timeToFirstToken: number
    tokensPerSecond: number
    responseLength: number
  } | null
}

function toModelResult(r: DbResponse): ModelResult {
  const provider = isValidProviderId(r.provider) ? r.provider : ('openai' as ModelResult['provider'])
  return {
    provider,
    label: r.label || (getModel(r.provider)?.label ?? r.provider),
    responseText: r.responseText,
    promptTokens: r.metrics?.promptTokens ?? 0,
    completionTokens: r.metrics?.completionTokens ?? 0,
    totalTokens: r.metrics?.totalTokens ?? 0,
    estimatedCost: r.metrics?.estimatedCost ?? 0,
    latencyMs: r.metrics?.latencyMs ?? 0,
    timeToFirstToken: r.metrics?.timeToFirstToken ?? 0,
    tokensPerSecond: r.metrics?.tokensPerSecond ?? 0,
    responseLength: r.metrics?.responseLength ?? 0,
  }
}

function toRecord(c: { id: string; prompt: string; createdAt: Date; shareToken: string | null; responses: DbResponse[] }): ComparisonRecord {
  return {
    id: c.id,
    prompt: c.prompt,
    createdAt: c.createdAt.toISOString(),
    shareToken: c.shareToken,
    responses: c.responses.map(toModelResult),
  }
}

export class HistoryService {
  constructor(private readonly repository: HistoryRepository) {}

  async findAll(userId: string, page: number, limit: number, isGuest = false): Promise<PaginatedResult<ComparisonRecord>> {
    const { comparisons, total } = await this.repository.findAllByUser(userId, page, limit)
    const data = comparisons.map(toRecord)
    return {
      data: isGuest ? data.map((r) => ({ ...r, shareToken: null })) : data,
      total,
      page,
      limit,
      hasMore: total > page * limit,
    }
  }

  async getOne(userId: string, id: string): Promise<ComparisonRecord | null> {
    const comparison = await this.repository.findByIdAndUser(id, userId)
    return comparison ? toRecord(comparison) : null
  }

  async getByShareToken(shareToken: string): Promise<ComparisonRecord | null> {
    const comparison = await this.repository.findByShareToken(shareToken)
    return comparison ? toRecord(comparison) : null
  }

  async create(userId: string, dto: CreateComparisonDto): Promise<ComparisonRecord> {
    const comparison = await this.repository.create(userId, dto)
    return toRecord(comparison)
  }

  async countByUser(userId: string): Promise<number> {
    return this.repository.countByUser(userId)
  }

  async hasReachedGuestLimit(userId: string): Promise<boolean> {
    const count = await this.repository.countByUser(userId)
    return count >= GUEST_COMPARISON_LIMIT
  }

  async saveComparison(
    userId: string,
    isGuest: boolean,
    dto: CreateComparisonDto,
  ): Promise<ComparisonRecord> {
    const record = await this.create(userId, dto)
    return isGuest ? { ...record, shareToken: null } : record
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.repository.deleteByIdAndUser(id, userId)
    return result.count > 0
  }
}
