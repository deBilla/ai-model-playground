import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatService } from '@/lib/modules/chat/chat.service'
import { getModel, calculateCost } from '@/lib/models.config'
import { streamText } from 'ai'

// Mock the AI SDK and model config
vi.mock('@ai-sdk/openai', () => ({
    createOpenAI: vi.fn(() => vi.fn())
}))

vi.mock('ai', () => ({
    streamText: vi.fn()
}))

vi.mock('@/lib/models.config', () => ({
    getModel: vi.fn(),
    calculateCost: vi.fn()
}))

describe('ChatService', () => {
    let service: ChatService

    beforeEach(() => {
        service = new ChatService()
        vi.clearAllMocks()
    })

    it('calls streamText with the correct parameters', () => {
        const mockModel = { id: 'openai', label: 'GPT-4o', gatewayModel: 'openai/gpt-4o' }
        vi.mocked(getModel).mockReturnValue(mockModel as any)

        const mockStreamResult = {
            textStream: { [Symbol.asyncIterator]: vi.fn() },
            usage: Promise.resolve({ promptTokens: 10, completionTokens: 5 }),
        }
        vi.mocked(streamText).mockReturnValue(mockStreamResult as any)

        const dto = {
            prompt: 'Hello AI',
            provider: 'openai',
            temperature: 0.7,
            maxTokens: 1024
        }

        const result = service.stream(dto)

        expect(getModel).toHaveBeenCalledWith('openai')
        expect(streamText).toHaveBeenCalledWith(expect.objectContaining({
            messages: [{ role: 'user', content: 'Hello AI' }],
            temperature: 0.7,
            maxOutputTokens: 1024
        }))

        expect(result.textStream).toBe(mockStreamResult.textStream)
        expect(result.usage).toBe(mockStreamResult.usage)
    })

    it('uses default values for temperature and maxTokens if not provided', () => {
        const mockModel = { id: 'openai', label: 'GPT-4o', gatewayModel: 'openai/gpt-4o' }
        vi.mocked(getModel).mockReturnValue(mockModel as any)
        vi.mocked(streamText).mockReturnValue({
            textStream: {},
            usage: Promise.resolve({}),
        } as any)

        service.stream({ prompt: 'test', provider: 'openai' })

        expect(streamText).toHaveBeenCalledWith(expect.objectContaining({
            temperature: 1.0,
            maxOutputTokens: 2048
        }))
    })

    it('costFor calls calculateCost with the correct model', () => {
        const mockModel = { id: 'openai' }
        vi.mocked(getModel).mockReturnValue(mockModel as any)
        vi.mocked(streamText).mockReturnValue({} as any)
        vi.mocked(calculateCost).mockReturnValue(0.002)

        const result = service.stream({ prompt: 'test', provider: 'openai' })
        const cost = result.costFor(100, 200)

        expect(calculateCost).toHaveBeenCalledWith(mockModel, 100, 200)
        expect(cost).toBe(0.002)
    })
})
