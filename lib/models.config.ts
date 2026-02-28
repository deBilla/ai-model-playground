export const MODELS = [
  {
    id: 'openai',
    label: 'OpenAI GPT-4o',
    provider: 'OpenAI',
    gatewayModel: 'openai/gpt-4o',
    inputCostPer1M: 5.00,
    outputCostPer1M: 15.00,
    color: 'bg-emerald-900/60',
    textColor: 'text-emerald-400',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude 3.5 Sonnet',
    provider: 'Anthropic',
    gatewayModel: 'anthropic/claude-3-5-sonnet-20241022',
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    color: 'bg-orange-900/60',
    textColor: 'text-orange-400',
  },
  {
    id: 'xai',
    label: 'xAI Grok-3',
    provider: 'xAI',
    gatewayModel: 'xai/grok-3',
    inputCostPer1M: 5.00,
    outputCostPer1M: 15.00,
    color: 'bg-purple-900/60',
    textColor: 'text-purple-400',
  },
] as const

export type ModelConfig = (typeof MODELS)[number]
export type ProviderId = ModelConfig['id']

export function getModel(id: string): ModelConfig | undefined {
  return MODELS.find((m) => m.id === id) as ModelConfig | undefined
}

export function isValidProviderId(id: string): id is ProviderId {
  return MODELS.some((m) => m.id === id)
}

export function calculateCost(
  model: ModelConfig,
  promptTokens: number,
  completionTokens: number,
): number {
  const inputCost = (promptTokens / 1_000_000) * model.inputCostPer1M
  const outputCost = (completionTokens / 1_000_000) * model.outputCostPer1M
  return inputCost + outputCost
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${parseFloat(usd.toFixed(6))}`
  if (usd < 1.00) return `$${parseFloat(usd.toFixed(4))}`
  return `$${usd.toFixed(2)}`
}
