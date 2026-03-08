import { z } from 'zod'

export const CompareRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(32_000, 'Prompt too long'),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(256).max(4096).optional(),
})

export type CompareRequestDto = z.infer<typeof CompareRequestSchema>
