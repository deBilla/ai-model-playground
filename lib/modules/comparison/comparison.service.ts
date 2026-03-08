import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { MODELS, getModel, calculateCost } from '@/lib/models.config'
import type { ProviderId } from '@/lib/models.config'

type ProviderStreamDto = {
  prompt: string
  provider: string
  temperature?: number
  maxTokens?: number
}

const gateway = createOpenAI({
  baseURL: 'https://ai-gateway.vercel.sh/v1',
  apiKey: process.env.VERCEL_AI_GATEWAY_KEY ?? '',
})

export class ComparisonService {
  fanOut(dto: Omit<ProviderStreamDto, 'provider'>) {
    return MODELS.map((model) => ({
      ...this.stream({ ...dto, provider: model.id as ProviderId }),
      provider: model.id,
      startTime: Date.now(),
    }))
  }

  stream(dto: ProviderStreamDto) {
    const model = getModel(dto.provider)!
    const streamResult = streamText({
      model: gateway(model.gatewayModel),
      system: 'You are a helpful AI assistant. Respond clearly and concisely. Format code in fenced code blocks with the appropriate language tag.',
      messages: [{ role: 'user', content: dto.prompt }],
      maxOutputTokens: dto.maxTokens ?? 2048,
      temperature: dto.temperature ?? 1.0,
    })
    return {
      textStream: streamResult.textStream,
      usage: streamResult.usage,
      costFor: (promptTokens: number, completionTokens: number) =>
        calculateCost(model, promptTokens, completionTokens),
    }
  }
}
