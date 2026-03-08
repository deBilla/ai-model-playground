import { Suspense } from 'react'
import HomeClient from '@/components/HomeClient'
import { authService } from '@/lib/modules/auth'
import { historyService } from '@/lib/modules/history'
import { getSessionUserIdFromCookies, getGuestUserIdFromCookies } from '@/lib/auth.server'
import type { User } from '@/lib/types'

async function resolveSession(): Promise<{ user: User | null; guestComparisonCount: number }> {
  // 1. Real authenticated user
  const sessionUserId = getSessionUserIdFromCookies()
  if (sessionUserId) {
    const user = await authService.me(sessionUserId)
    if (user) return { user, guestComparisonCount: 0 }
  }

  // 2. Existing guest session
  const guestUserId = getGuestUserIdFromCookies()
  if (guestUserId) {
    const user = await authService.getGuestById(guestUserId)
    if (user) {
      const guestComparisonCount = await historyService.countByUser(guestUserId)
      return { user, guestComparisonCount }
    }
  }

  // 3. No session — client will call POST /api/guests
  return { user: null, guestComparisonCount: 0 }
}

export default async function Page() {
  const { user, guestComparisonCount } = await resolveSession()

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-neutral-400 text-sm">Loading...</div>
      </div>
    }>
      <HomeClient initialUser={user} initialGuestComparisonCount={guestComparisonCount} />
    </Suspense>
  )
}
