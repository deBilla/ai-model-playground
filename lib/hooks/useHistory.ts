import { useCallback } from 'react'
import { usePlaygroundStore } from '@/lib/store'

export function useHistory() {
    const setHistory = usePlaygroundStore((s) => s.setHistory)
    const appendHistory = usePlaygroundStore((s) => s.appendHistory)
    const removeFromHistory = usePlaygroundStore((s) => s.removeFromHistory)

    const getHistory = useCallback(async (page: number, limit: number, isInitial = false, signal?: AbortSignal) => {
        const res = await fetch(`/api/comparisons?page=${page}&limit=${limit}`, { signal })
        if (!res.ok) {
            throw new Error('Failed to fetch history')
        }
        const data = await res.json()
        if (data?.data) {
            if (isInitial) {
                setHistory(data.data)
            } else {
                appendHistory(data.data)
            }
        }
        return data
    }, [setHistory, appendHistory])

    const deleteComparison = useCallback(async (id: string) => {
        const res = await fetch(`/api/comparisons/${encodeURIComponent(id)}`, { method: 'DELETE' })
        if (!res.ok) {
            throw new Error('Delete failed')
        }
        removeFromHistory(id)
    }, [removeFromHistory])

    return { getHistory, deleteComparison }
}
