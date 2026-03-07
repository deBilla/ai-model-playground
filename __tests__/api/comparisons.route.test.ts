import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/comparisons/route'
import { historyService } from '@/lib/modules/history'
import { getUserFromRequest } from '@/lib/auth'
import { buildMultiplexedStream } from '@/lib/modules/chat/buildMultiplexedStream'
import { chatService } from '@/lib/modules/chat'

vi.mock('@/lib/modules/history', () => ({
    historyService: {
        findAll: vi.fn(),
        hasReachedGuestLimit: vi.fn(),
        saveComparison: vi.fn(),
    }
}))

vi.mock('@/lib/modules/chat', () => ({
    chatService: {
        stream: vi.fn(),
    }
}))

vi.mock('@/lib/modules/chat/buildMultiplexedStream', () => ({
    buildMultiplexedStream: vi.fn(),
}))

vi.mock('@/lib/models.config', () => ({
    MODELS: [{ id: 'openai' }, { id: 'anthropic' }],
    getModel: vi.fn((id: string) => ({ id, label: id })),
    isValidProviderId: vi.fn(() => true),
}))

vi.mock('@/lib/auth', async () => {
    const actual = await vi.importActual('@/lib/auth') as any
    return {
        ...actual,
        getUserFromRequest: vi.fn(),
        getGuestFromRequest: vi.fn(() => null),
        unauthorized: vi.fn(() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }))
    }
})

function createAuthRequest(url: string, method = 'GET', body: any = null) {
    return new NextRequest(url, {
        method,
        headers: {
            Cookie: 'session=mock-token'
        },
        body: body ? JSON.stringify(body) : null
    })
}

describe('Comparisons Route', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getUserFromRequest).mockReturnValue('user-1' as any)
    })

    describe('GET', () => {
        it('returns unauthorized if no user is found', async () => {
            vi.mocked(getUserFromRequest).mockReturnValue(null)
            const req = new NextRequest('http://localhost/api/comparisons')

            const res = await GET(req)
            expect(res.status).toBe(401)
        })

        it('returns history data with default pagination', async () => {
            const mockResult = { data: [], total: 0, page: 1, limit: 20, hasMore: false }
            vi.mocked(historyService.findAll).mockResolvedValue(mockResult as any)

            const req = createAuthRequest('http://localhost/api/comparisons')
            const res = await GET(req)

            expect(res.status).toBe(200)
            expect(await res.json()).toEqual(mockResult)
            expect(historyService.findAll).toHaveBeenCalledWith('user-1', 1, 20, false)
        })

        it('uses pagination parameters from URL', async () => {
            vi.mocked(historyService.findAll).mockResolvedValue({} as any)

            const req = createAuthRequest('http://localhost/api/comparisons?page=2&limit=10')
            await GET(req)

            expect(historyService.findAll).toHaveBeenCalledWith('user-1', 2, 10, false)
        })
    })

    describe('POST', () => {
        it('returns unauthorized if no user is found', async () => {
            vi.mocked(getUserFromRequest).mockReturnValue(null)
            const req = new NextRequest('http://localhost/api/comparisons', { method: 'POST' })

            const res = await POST(req)
            expect(res.status).toBe(401)
        })

        it('returns 400 for invalid JSON body', async () => {
            const req = new NextRequest('http://localhost/api/comparisons', {
                method: 'POST',
                headers: { Cookie: 'session=mock-token' },
                body: 'invalid-json'
            })
            const res = await POST(req)

            expect(res.status).toBe(400)
            expect(await res.text()).toBe('Invalid JSON body')
        })

        it('returns 422 for invalid body', async () => {
            const req = createAuthRequest('http://localhost/api/comparisons', 'POST', { prompt: '' })
            const res = await POST(req)

            expect(res.status).toBe(422)
        })

        it('fans out to all models and returns NDJSON stream on success', async () => {
            const mockStream = new ReadableStream()
            vi.mocked(chatService.stream).mockReturnValue({ textStream: {}, usage: Promise.resolve({}) } as any)
            vi.mocked(buildMultiplexedStream).mockReturnValue(mockStream)

            const req = createAuthRequest('http://localhost/api/comparisons', 'POST', {
                prompt: 'Test prompt',
                temperature: 0.7,
                maxTokens: 512,
            })
            const res = await POST(req)

            expect(res.status).toBe(200)
            expect(res.headers.get('Content-Type')).toBe('application/x-ndjson; charset=utf-8')
            expect(res.headers.get('Cache-Control')).toBe('no-cache')
            expect(chatService.stream).toHaveBeenCalledTimes(2) // one per model
            expect(buildMultiplexedStream).toHaveBeenCalledOnce()
        })
    })
})
