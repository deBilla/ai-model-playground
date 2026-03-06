import { useCallback } from 'react'
import { usePlaygroundStore } from '@/lib/store'
import type { User } from '@/lib/types'

export function useGuest() {
    const setUser = usePlaygroundStore((s) => s.setUser)
    const setGuestComparisonCount = usePlaygroundStore((s) => s.setGuestComparisonCount)

    const createGuest = useCallback(async () => {
        try {
            const res = await fetch('/api/guests', { method: 'POST' })
            if (!res.ok) {
                throw new Error('Failed to create guest session')
            }
            const data = await res.json()
            if (data?.user) {
                setUser(data.user as User)
                setGuestComparisonCount(0)
            }
        } catch (err) {
            console.error(err)
        }
    }, [setUser, setGuestComparisonCount])

    return { createGuest }
}
