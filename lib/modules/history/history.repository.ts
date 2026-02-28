import { prisma } from '@/lib/db'
import type { CreateComparisonDto } from './history.dto'

const INCLUDE_FULL = { responses: { include: { metrics: true } } } as const

export class HistoryRepository {
  async findAllByUser(userId: string, page: number, limit: number) {
    const [comparisons, total] = await Promise.all([
      prisma.comparison.findMany({
        where: { userId },
        include: INCLUDE_FULL,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.comparison.count({ where: { userId } }),
    ])
    return { comparisons, total }
  }

  async findByIdAndUser(id: string, userId: string) {
    return prisma.comparison.findFirst({
      where: { id, userId },
      include: INCLUDE_FULL,
    })
  }

  async findByShareToken(shareToken: string) {
    return prisma.comparison.findUnique({
      where: { shareToken },
      include: INCLUDE_FULL,
    })
  }

  async create(userId: string, dto: CreateComparisonDto) {
    return prisma.comparison.create({
      data: {
        prompt: dto.prompt.trim(),
        userId,
        responses: {
          create: dto.responses.map((r) => ({
            provider: r.provider,
            label: r.label,
            responseText: r.responseText,
            metrics: {
              create: {
                promptTokens: r.promptTokens,
                completionTokens: r.completionTokens,
                totalTokens: r.totalTokens,
                estimatedCost: r.estimatedCost,
                latencyMs: r.latencyMs,
                timeToFirstToken: r.timeToFirstToken,
                tokensPerSecond: r.tokensPerSecond,
                responseLength: r.responseLength,
              },
            },
          })),
        },
      },
      include: INCLUDE_FULL,
    })
  }

  async countByUser(userId: string): Promise<number> {
    return prisma.comparison.count({ where: { userId } })
  }

  async deleteByIdAndUser(id: string, userId: string) {
    return prisma.comparison.deleteMany({ where: { id, userId } })
  }
}
