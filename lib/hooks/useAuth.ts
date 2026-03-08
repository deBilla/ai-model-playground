import { useCallback } from 'react'

export function useAuth() {
    const login = useCallback(async (email: string, password: string) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })
        const data = await res.json()
        if (!res.ok) {
            throw data.error as string | Record<string, string[]>
        }
        return data.user
    }, [])

    const register = useCallback(async (email: string, password: string, name?: string) => {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
        })
        const data = await res.json()
        if (!res.ok) {
            throw data.error as string | Record<string, string[]>
        }
        return data.user
    }, [])

    const logout = useCallback(async () => {
        const res = await fetch('/api/auth/logout', { method: 'POST' })
        if (!res.ok) {
            throw new Error('Logout failed')
        }
    }, [])

    return { login, register, logout }
}
