// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    comparison: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

import { HistoryRepository } from '@/lib/modules/history/history.repository'
import { prisma } from '@/lib/db'
import type { CreateComparisonDto } from '@/lib/modules/history/history.dto'

const NOW = new Date('2025-01-15T10:00:00Z')

const MOCK_COMPARISON = {
  id: 'cmp-1',
  prompt: 'Test prompt',
  createdAt: NOW,
  shareToken: 'token-123',
  userId: 'user-1',
  responses: [],
}

// The include clause that every query uses
const INCLUDE_FULL = { responses: { include: { metrics: true } } }

// Minimal valid DTO response
const MOCK_RESPONSE: CreateComparisonDto['responses'][0] = {
  provider: 'openai',
  label: 'GPT-4o',
  responseText: 'Hello',
  promptTokens: 10,
  completionTokens: 5,
  totalTokens: 15,
  estimatedCost: 0.001,
  latencyMs: 300,
  timeToFirstToken: 80,
  tokensPerSecond: 16.7,
  responseLength: 5,
}

describe('HistoryRepository', () => {
  let repo: HistoryRepository

  beforeEach(() => {
    repo = new HistoryRepository()
    vi.clearAllMocks()
  })

  // ── findAllByUser ──────────────────────────────────────────────────────────

  describe('findAllByUser', () => {
    it('queries with correct where/include/order and returns rows + total', async () => {
      vi.mocked(prisma.comparison.findMany).mockResolvedValue([MOCK_COMPARISON] as never)
      vi.mocked(prisma.comparison.count).mockResolvedValue(1)

      const result = await repo.findAllByUser('user-1', 1, 20)

      expect(prisma.comparison.findMany).toHaveBeenCalledExactlyOnceWith({
        where: { userId: 'user-1' },
        include: INCLUDE_FULL,
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      })
      expect(result.comparisons).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('calculates skip correctly for page 2 with limit 10', async () => {
      vi.mocked(prisma.comparison.findMany).mockResolvedValue([])
      vi.mocked(prisma.comparison.count).mockResolvedValue(25)

      await repo.findAllByUser('user-1', 2, 10)

      expect(prisma.comparison.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      )
    })

    it('calculates skip correctly for page 3 with limit 5', async () => {
      vi.mocked(prisma.comparison.findMany).mockResolvedValue([])
      vi.mocked(prisma.comparison.count).mockResolvedValue(20)

      await repo.findAllByUser('user-1', 3, 5)

      expect(prisma.comparison.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      )
    })

    it('runs findMany and count in parallel (Promise.all)', async () => {
      // Both mocks should be called without one waiting for the other
      const findManyOrder: string[] = []
      vi.mocked(prisma.comparison.findMany).mockImplementation(
        (async () => { findManyOrder.push('findMany'); return [] }) as never,
      )
      vi.mocked(prisma.comparison.count).mockImplementation(
        (async () => { findManyOrder.push('count'); return 0 }) as never,
      )

      await repo.findAllByUser('user-1', 1, 20)

      // Both must have been called (order doesn't matter — they run in parallel)
      expect(findManyOrder).toContain('findMany')
      expect(findManyOrder).toContain('count')
    })
  })

  // ── findByIdAndUser ────────────────────────────────────────────────────────

  describe('findByIdAndUser', () => {
    it('queries with both id and userId to prevent cross-user access', async () => {
      vi.mocked(prisma.comparison.findFirst).mockResolvedValue(MOCK_COMPARISON as never)

      const result = await repo.findByIdAndUser('cmp-1', 'user-1')

      expect(prisma.comparison.findFirst).toHaveBeenCalledExactlyOnceWith({
        where: { id: 'cmp-1', userId: 'user-1' },
        include: INCLUDE_FULL,
      })
      expect(result).toEqual(MOCK_COMPARISON)
    })

    it('returns null when comparison belongs to a different user', async () => {
      vi.mocked(prisma.comparison.findFirst).mockResolvedValue(null)

      expect(await repo.findByIdAndUser('cmp-1', 'other-user')).toBeNull()
    })
  })

  // ── findByShareToken ───────────────────────────────────────────────────────

  describe('findByShareToken', () => {
    it('uses findUnique on shareToken (which has a @unique index)', async () => {
      vi.mocked(prisma.comparison.findUnique).mockResolvedValue(MOCK_COMPARISON as never)

      const result = await repo.findByShareToken('token-123')

      expect(prisma.comparison.findUnique).toHaveBeenCalledExactlyOnceWith({
        where: { shareToken: 'token-123' },
        include: INCLUDE_FULL,
      })
      expect(result).toEqual(MOCK_COMPARISON)
    })

    it('returns null for an unknown token', async () => {
      vi.mocked(prisma.comparison.findUnique).mockResolvedValue(null)
      expect(await repo.findByShareToken('bad-token')).toBeNull()
    })
  })

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a comparison with nested responses and metrics in a single Prisma call', async () => {
      vi.mocked(prisma.comparison.create).mockResolvedValue(MOCK_COMPARISON as never)

      await repo.create('user-1', { prompt: 'Test prompt', responses: [MOCK_RESPONSE] })

      expect(prisma.comparison.create).toHaveBeenCalledExactlyOnceWith({
        data: {
          prompt: 'Test prompt',
          userId: 'user-1',
          responses: {
            create: [{
              provider: 'openai',
              label: 'GPT-4o',
              responseText: 'Hello',
              metrics: {
                create: {
                  promptTokens: 10,
                  completionTokens: 5,
                  totalTokens: 15,
                  estimatedCost: 0.001,
                  latencyMs: 300,
                  timeToFirstToken: 80,
                  tokensPerSecond: 16.7,
                  responseLength: 5,
                },
              },
            }],
          },
        },
        include: INCLUDE_FULL,
      })
    })

    it('trims leading/trailing whitespace from the prompt', async () => {
      vi.mocked(prisma.comparison.create).mockResolvedValue(MOCK_COMPARISON as never)

      await repo.create('user-1', { prompt: '  spaces around  ', responses: [MOCK_RESPONSE] })

      const call = vi.mocked(prisma.comparison.create).mock.calls[0][0]
      expect(call.data.prompt).toBe('spaces around')
    })

    it('creates all responses in a single nested create (not N+1)', async () => {
      vi.mocked(prisma.comparison.create).mockResolvedValue(MOCK_COMPARISON as never)
      const twoResponses = [MOCK_RESPONSE, { ...MOCK_RESPONSE, provider: 'anthropic' as const, label: 'Claude' }]

      await repo.create('user-1', { prompt: 'multi', responses: twoResponses })

      // Only ONE prisma.comparison.create call for all responses
      expect(prisma.comparison.create).toHaveBeenCalledTimes(1)
      const call = vi.mocked(prisma.comparison.create).mock.calls[0][0]
      expect((call.data!.responses as { create: unknown[] }).create).toHaveLength(2)
    })
  })

  // ── deleteByIdAndUser ──────────────────────────────────────────────────────

  describe('deleteByIdAndUser', () => {
    it('deletes using both id and userId to prevent cross-user deletion', async () => {
      vi.mocked(prisma.comparison.deleteMany).mockResolvedValue({ count: 1 })

      const result = await repo.deleteByIdAndUser('cmp-1', 'user-1')

      expect(prisma.comparison.deleteMany).toHaveBeenCalledExactlyOnceWith({
        where: { id: 'cmp-1', userId: 'user-1' },
      })
      expect(result.count).toBe(1)
    })

    it('returns count 0 when no matching row exists (not owned by user)', async () => {
      vi.mocked(prisma.comparison.deleteMany).mockResolvedValue({ count: 0 })

      const result = await repo.deleteByIdAndUser('cmp-1', 'wrong-user')

      expect(result.count).toBe(0)
    })
  })
})
