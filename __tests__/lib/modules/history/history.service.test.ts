import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HistoryService } from '@/lib/modules/history/history.service'
import type { HistoryRepository } from '@/lib/modules/history/history.repository'

// ──────────────────────────────────────────────────────────────────────────────
// Mock helpers — include all Prisma-required fields so TypeScript is happy,
// but cast to `never` on mockResolvedValue since we're testing service logic
// and don't want to maintain a 1:1 copy of the Prisma generated schema.
// ──────────────────────────────────────────────────────────────────────────────

function makeDbMetrics(override: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'metric-1',
    modelResponseId: 'resp-1',
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
    estimatedCost: 0.001,
    latencyMs: 300,
    timeToFirstToken: 80,
    tokensPerSecond: 16.7,
    responseLength: 13,
    ...override,
  }
}

function makeDbResponse(
  id = 'resp-1',
  provider = 'openai',
  label = 'GPT-4o',
  metricsOverride?: null,
) {
  return {
    id,
    comparisonId: 'cmp-1',
    provider,
    label,
    responseText: 'Test response',
    metrics: metricsOverride === null ? null : makeDbMetrics({ id: `metric-${id}`, modelResponseId: id }),
  }
}

function makeDbComparison(id = 'cmp-1') {
  return {
    id,
    prompt: 'What is the capital of France?',
    createdAt: new Date('2025-01-15T10:00:00Z'),
    shareToken: 'share-abc123',
    userId: 'user-1',
    responses: [
      makeDbResponse('resp-1', 'openai', 'GPT-4o'),
      makeDbResponse('resp-2', 'anthropic', 'Claude 3.5 Sonnet'),
    ],
  }
}

function makeMockRepo(): HistoryRepository {
  return {
    findAllByUser: vi.fn(),
    findByIdAndUser: vi.fn(),
    findByShareToken: vi.fn(),
    create: vi.fn(),
    deleteByIdAndUser: vi.fn(),
  } as unknown as HistoryRepository
}

describe('HistoryService', () => {
  let repo: HistoryRepository
  let service: HistoryService

  beforeEach(() => {
    repo = makeMockRepo()
    service = new HistoryService(repo)
  })

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns a paginated result with data mapped to ComparisonRecord', async () => {
      vi.mocked(repo.findAllByUser).mockResolvedValue({
        comparisons: [makeDbComparison()] as never,
        total: 1,
      })

      const result = await service.findAll('user-1', 1, 20)

      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
      expect(result.hasMore).toBe(false)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].prompt).toBe('What is the capital of France?')
      expect(result.data[0].responses).toHaveLength(2)
    })

    it('sets hasMore=true when total > page * limit', async () => {
      vi.mocked(repo.findAllByUser).mockResolvedValue({
        comparisons: Array.from({ length: 20 }, (_, i) => makeDbComparison(`cmp-${i}`)) as never,
        total: 45,
      })

      const result = await service.findAll('user-1', 1, 20)
      expect(result.hasMore).toBe(true)
    })

    it('sets hasMore=false on the last page', async () => {
      vi.mocked(repo.findAllByUser).mockResolvedValue({
        comparisons: [makeDbComparison()] as never,
        total: 21,
      })

      const result = await service.findAll('user-1', 2, 20)  // page 2 of 21 total
      expect(result.hasMore).toBe(false)
    })
  })

  // ── getOne ─────────────────────────────────────────────────────────────────

  describe('getOne', () => {
    it('maps a DB comparison to a ComparisonRecord', async () => {
      vi.mocked(repo.findByIdAndUser).mockResolvedValue(makeDbComparison('cmp-42') as never)

      const record = await service.getOne('user-1', 'cmp-42')

      expect(record).not.toBeNull()
      expect(record!.id).toBe('cmp-42')
      expect(record!.shareToken).toBe('share-abc123')
      expect(record!.createdAt).toBe('2025-01-15T10:00:00.000Z')
    })

    it('maps metrics correctly onto each ModelResult', async () => {
      vi.mocked(repo.findByIdAndUser).mockResolvedValue(makeDbComparison() as never)

      const record = await service.getOne('user-1', 'cmp-1')
      const openaiResult = record!.responses.find((r) => r.provider === 'openai')!

      expect(openaiResult.promptTokens).toBe(10)
      expect(openaiResult.completionTokens).toBe(5)
      expect(openaiResult.totalTokens).toBe(15)
      expect(openaiResult.latencyMs).toBe(300)
      expect(openaiResult.timeToFirstToken).toBe(80)
      expect(openaiResult.tokensPerSecond).toBeCloseTo(16.7)
      expect(openaiResult.responseLength).toBe(13)
      expect(openaiResult.estimatedCost).toBe(0.001)
    })

    it('returns null when comparison is not found', async () => {
      vi.mocked(repo.findByIdAndUser).mockResolvedValue(null)
      const result = await service.getOne('user-1', 'nonexistent')
      expect(result).toBeNull()
    })

    it('uses 0 defaults when metrics are null', async () => {
      const dbComp = makeDbComparison()
      // Override first response to have null metrics
      dbComp.responses[0] = makeDbResponse('resp-1', 'openai', 'GPT-4o', null)
      vi.mocked(repo.findByIdAndUser).mockResolvedValue(dbComp as never)

      const record = await service.getOne('user-1', 'cmp-1')
      const r = record!.responses[0]
      expect(r.promptTokens).toBe(0)
      expect(r.completionTokens).toBe(0)
      expect(r.estimatedCost).toBe(0)
      expect(r.latencyMs).toBe(0)
    })
  })

  // ── getByShareToken ────────────────────────────────────────────────────────

  describe('getByShareToken', () => {
    it('returns a record for a valid share token', async () => {
      vi.mocked(repo.findByShareToken).mockResolvedValue(makeDbComparison() as never)

      const record = await service.getByShareToken('share-abc123')
      expect(record).not.toBeNull()
      expect(record!.shareToken).toBe('share-abc123')
    })

    it('returns null for an unknown share token', async () => {
      vi.mocked(repo.findByShareToken).mockResolvedValue(null)
      expect(await service.getByShareToken('bad-token')).toBeNull()
    })
  })

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('returns true when a row was deleted', async () => {
      vi.mocked(repo.deleteByIdAndUser).mockResolvedValue({ count: 1 })
      expect(await service.delete('user-1', 'cmp-1')).toBe(true)
    })

    it('returns false when no rows were deleted (comparison not owned by user)', async () => {
      vi.mocked(repo.deleteByIdAndUser).mockResolvedValue({ count: 0 })
      expect(await service.delete('user-1', 'someone-elses-cmp')).toBe(false)
    })
  })
})
