'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createSupabaseBrowserClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      if (process.env.NODE_ENV !== 'production') {
        const response = await fetch('/api/demo-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        if (response.status !== 404) {
          const result = (await response.json()) as { role?: string; error?: string }
          if (!response.ok) {
            throw new Error(result.error || 'Demo sign-in failed')
          }

          const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
          const destination =
            result.role === 'admin' && safeNext === '/dashboard'
              ? '/admin/dashboard'
              : safeNext
          router.push(destination)
          router.refresh()
          return
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      if (data.user) {
        // Check user role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        if (profile?.role === 'admin' && next === '/dashboard') {
          router.push('/admin')
        } else {
          router.push(next)
        }
        router.refresh()
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Invalid login credentials. Please check your email and password.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
      <h2 className="text-xl font-bold text-neutral-900 mb-1">Welcome back</h2>
      <p className="text-xs text-neutral-500 mb-6">
        Sign in to view orders, review proofs, or reorder past jobs.
      </p>

      {errorMsg && (
        <div className="p-3 mb-5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Password
            </label>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
        >
          {loading ? 'Authenticating...' : 'Sign In →'}
        </button>
      </form>

      <div className="mt-5 text-center text-xs text-neutral-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-amber-600 font-semibold hover:underline">
          Create one now
        </Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-neutral-500">Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}
