import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/chats/route'
import { chatService } from '@/lib/modules/chat'
import { buildNdjsonStream } from '@/lib/modules/chat/buildNdjsonStream'
import { getUserFromRequest } from '@/lib/auth'

// Mock dependencies
vi.mock('@/lib/modules/chat', () => ({
    chatService: {
        stream: vi.fn(),
    }
}))

vi.mock('@/lib/modules/chat/buildNdjsonStream', () => ({
    buildNdjsonStream: vi.fn(),
}))

vi.mock('@/lib/auth', async () => {
    const actual = await vi.importActual('@/lib/auth') as any
    return {
        ...actual,
        getUserFromRequest: vi.fn(),
        unauthorized: vi.fn(() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }))
    }
})

function createAuthRequest(url: string, body: any = null) {
    return new NextRequest(url, {
        method: 'POST',
        headers: {
            Cookie: 'session=mock-token',
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : null
    })
}

describe('Chats Route', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getUserFromRequest).mockReturnValue('user-1' as any)
    })

    it('returns unauthorized if no user is found', async () => {
        vi.mocked(getUserFromRequest).mockReturnValue(null)
        const req = new NextRequest('http://localhost/api/chats', { method: 'POST' })

        const res = await POST(req)
        expect(res.status).toBe(401)
    })

    it('returns 400 for invalid JSON body', async () => {
        const req = new NextRequest('http://localhost/api/chats', {
            method: 'POST',
            headers: { Cookie: 'session=mock-token' },
            body: 'invalid-json'
        })
        const res = await POST(req)

        expect(res.status).toBe(400)
        expect(await res.text()).toBe('Invalid JSON body')
    })

    it('returns 422 for invalid provider ID', async () => {
        const req = createAuthRequest('http://localhost/api/chats', {
            prompt: 'hello',
            provider: 'invalid-provider'
        })
        const res = await POST(req)

        expect(res.status).toBe(422)
    })

    it('returns 422 for empty prompt', async () => {
        const req = createAuthRequest('http://localhost/api/chats', {
            prompt: '',
            provider: 'openai'
        })
        const res = await POST(req)

        expect(res.status).toBe(422)
    })

    it('calls chatService.stream and returns a stream with correct headers on success', async () => {
        const mockChatResult = { textStream: {}, usage: Promise.resolve({}), costFor: vi.fn() }
        vi.mocked(chatService.stream).mockReturnValue(mockChatResult as any)

        const mockStream = new ReadableStream()
        vi.mocked(buildNdjsonStream).mockReturnValue(mockStream as any)

        const payload = {
            prompt: 'Tell me a joke',
            provider: 'openai',
            temperature: 0.8,
            maxTokens: 512
        }
        const req = createAuthRequest('http://localhost/api/chats', payload)
        const res = await POST(req)

        expect(res.status).toBe(200)
        expect(res.headers.get('Content-Type')).toBe('application/x-ndjson; charset=utf-8')
        expect(res.headers.get('Cache-Control')).toBe('no-cache')

        expect(chatService.stream).toHaveBeenCalledWith(payload)
        expect(buildNdjsonStream).toHaveBeenCalledWith(mockChatResult, expect.any(Number), 'openai')
    })
})
