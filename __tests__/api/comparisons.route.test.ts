import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/comparisons/route'
import { historyService } from '@/lib/modules/history'
import { getUserFromRequest, signToken } from '@/lib/auth'

// Mock the history service and auth utilities
vi.mock('@/lib/modules/history', () => ({
    historyService: {
        findAll: vi.fn(),
        create: vi.fn(),
    }
}))

vi.mock('@/lib/auth', async () => {
    const actual = await vi.importActual('@/lib/auth') as any
    return {
        ...actual,
        getUserFromRequest: vi.fn(),
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
            expect(historyService.findAll).toHaveBeenCalledWith('user-1', 1, 20)
        })

        it('uses pagination parameters from URL', async () => {
            vi.mocked(historyService.findAll).mockResolvedValue({} as any)

            const req = createAuthRequest('http://localhost/api/comparisons?page=2&limit=10')
            await GET(req)

            expect(historyService.findAll).toHaveBeenCalledWith('user-1', 2, 10)
        })
    })

    describe('POST', () => {
        const validBody = {
            prompt: 'Test prompt',
            responses: [
                {
                    provider: 'openai',
                    label: 'GPT-4o',
                    responseText: 'Hello',
                    promptTokens: 10,
                    completionTokens: 5,
                    totalTokens: 15,
                    latencyMs: 300,
                    estimatedCost: 0.001,
                    timeToFirstToken: 80,
                    tokensPerSecond: 16.7,
                    responseLength: 5
                }
            ]
        }

        it('returns unauthorized if no user is found', async () => {
            vi.mocked(getUserFromRequest).mockReturnValue(null)
            const req = new NextRequest('http://localhost/api/comparisons', { method: 'POST' })

            const res = await POST(req)
            expect(res.status).toBe(401)
        })

        it('returns 422 for invalid body', async () => {
            const req = createAuthRequest('http://localhost/api/comparisons', 'POST', { prompt: '' })
            const res = await POST(req)

            expect(res.status).toBe(422)
            expect(historyService.create).not.toHaveBeenCalled()
        })

        it('calls historyService.create and returns 201 on success', async () => {
            vi.mocked(historyService.create).mockResolvedValue({ id: 'cmp-1' } as any)

            const req = createAuthRequest('http://localhost/api/comparisons', 'POST', validBody)
            const res = await POST(req)

            expect(res.status).toBe(201)
            expect(historyService.create).toHaveBeenCalledWith('user-1', validBody)
        })
    })
})
