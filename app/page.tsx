import { Suspense } from 'react'
import HomeClient from '@/components/HomeClient'

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-neutral-400 text-sm">Loading...</div>
      </div>
    }>
      <HomeClient />
    </Suspense>
  )
}