import { z } from 'zod'
import { isValidProviderId } from '@/lib/models.config'

const ModelResultSchema = z.object({
  provider: z.string().refine(isValidProviderId),
  label: z.string(),
  responseText: z.string(),
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  estimatedCost: z.number().min(0),
  latencyMs: z.number().int().min(0),
  timeToFirstToken: z.number().int().min(0),
  tokensPerSecond: z.number().min(0),
  responseLength: z.number().int().min(0),
})

export const CreateComparisonSchema = z.object({
  prompt: z.string().min(1).max(32_000),
  responses: z.array(ModelResultSchema).min(1),
})

export const DeleteComparisonSchema = z.object({
  id: z.string().min(1),
})

export const ListComparisonsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type CreateComparisonDto = z.infer<typeof CreateComparisonSchema>
export type DeleteComparisonDto = z.infer<typeof DeleteComparisonSchema>
export type ListComparisonsDto = z.infer<typeof ListComparisonsSchema>
