import { z } from 'zod'
import { isValidProviderId } from '@/lib/models.config'

export const ChatRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(32_000, 'Prompt too long'),
  provider: z.string().refine(isValidProviderId, { message: 'Invalid provider ID' }),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(256).max(4096).optional(),
})

export type ChatRequestDto = z.infer<typeof ChatRequestSchema>
