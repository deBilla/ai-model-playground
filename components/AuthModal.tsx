'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { usePlaygroundStore } from '@/lib/store'
import type { User } from '@/lib/types'

type Tab = 'login' | 'register'

interface FieldErrors {
  email?: string[]
  password?: string[]
  name?: string[]
}

export default function AuthModal() {
  const user = usePlaygroundStore((s) => s.user)
  const setUser = usePlaygroundStore((s) => s.setUser)
  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) setTimeout(() => firstInputRef.current?.focus(), 100)
  }, [user, tab])

  const resetForm = () => { setEmail(''); setPassword(''); setName(''); setErrors({}); setServerError('') }
  const switchTab = (t: Tab) => { setTab(t); resetForm() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setServerError('')
    if (!email.includes('@')) { setErrors({ email: ['Enter a valid email'] }); return }
    if (password.length < 8) { setErrors({ password: ['Password must be at least 8 characters'] }); return }

    setLoading(true)
    const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register'
    const body = tab === 'login' ? { email, password } : { email, password, name: name || undefined }
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (typeof data.error === 'object') { setErrors(data.error) } else { setServerError(data.error ?? 'Something went wrong') }
        return
      }
      setUser(data.user as User)
    } catch {
      setServerError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!user}>
      <DialogContent className="sm:max-w-sm bg-neutral-900 border-neutral-700 text-white p-0 overflow-hidden [&>button]:text-neutral-400">
        <Tabs value={tab} onValueChange={(v) => switchTab(v as Tab)}>
          <TabsList className="w-full rounded-none border-b border-neutral-700 bg-transparent h-auto p-0">
            {(['login', 'register'] as Tab[]).map((t) => (
              <TabsTrigger key={t} value={t}
                className="flex-1 rounded-none py-3 capitalize data-[state=active]:bg-neutral-800 data-[state=active]:text-white text-neutral-400">
                {t === 'login' ? 'Sign In' : 'Register'}
              </TabsTrigger>
            ))}
          </TabsList>

          {(['login', 'register'] as Tab[]).map((t) => (
            <TabsContent key={t} value={t} className="p-6 mt-0">
              <DialogHeader className="mb-4">
                <DialogTitle className="text-white">
                  {t === 'login' ? 'Welcome back' : 'Create an account'}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {t === 'register' && (
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1" htmlFor="auth-name">Name (optional)</label>
                    <input id="auth-name" ref={t === tab && tab === 'register' ? firstInputRef : undefined}
                      type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Your name" />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-neutral-400 mb-1" htmlFor="auth-email">Email</label>
                  <input id="auth-email" ref={t === tab && tab === 'login' ? firstInputRef : undefined}
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                    className={`w-full rounded-lg border bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.email ? 'border-red-500' : 'border-neutral-700'}`}
                    placeholder="you@example.com" />
                  {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email[0]}</p>}
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1" htmlFor="auth-password">Password</label>
                  <input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    required autoComplete={t === 'login' ? 'current-password' : 'new-password'}
                    className={`w-full rounded-lg border bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.password ? 'border-red-500' : 'border-neutral-700'}`}
                    placeholder={t === 'register' ? 'Min 8 characters' : '••••••••'} />
                  {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password[0]}</p>}
                </div>
                {serverError && <p className="text-xs text-red-400" role="alert">{serverError}</p>}
                <Button type="submit" disabled={loading} className="w-full bg-sky-600 hover:bg-sky-500">
                  {loading ? 'Please wait…' : t === 'login' ? 'Sign In' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
