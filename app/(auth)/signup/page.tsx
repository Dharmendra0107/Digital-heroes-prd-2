'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoAuthEnabled, setDemoAuthEnabled] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    fetch('/api/demo-auth')
      .then((response) => setDemoAuthEnabled(response.ok))
      .catch((error: unknown) => {
        console.error('[SignupPage] failed to check demo auth:', error)
      })
  }, [])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            company: company || undefined,
            role: 'customer',
          },
        },
      })

      if (error) {
        throw error
      }

      if (data.session) {
        // Immediate session granted
        router.push('/dashboard')
        router.refresh()
      } else {
        // Supabase email confirmation setting is active
        setSuccessMsg(
          'Account registered! Please check your email inbox to confirm your account, then sign in.'
        )
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to create account. Please verify details and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
      <h2 className="text-xl font-bold text-neutral-900 mb-1">Create an account</h2>
      <p className="text-xs text-neutral-500 mb-6">
        Order custom print, review proof versions, and reorder in one click.
      </p>

      {errorMsg && (
        <div className="p-3 mb-5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs leading-relaxed">
          {successMsg}
          <div className="mt-2 font-medium">
            <Link href="/login" className="underline text-emerald-900">
              Go to Login &rarr;
            </Link>
          </div>
        </div>
      )}

      {demoAuthEnabled ? (
        <div className="p-4 bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-xl text-xs leading-relaxed">
          New account registration is currently unavailable. Please contact us to set up an account.
        </div>
      ) : !successMsg ? (
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@studio.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
              Company / Brand (Optional)
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Studio or Club Name"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
              Password (min 6 chars)
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
          >
            {loading ? 'Registering...' : 'Create Customer Account →'}
          </button>
        </form>
      ) : null}

      <div className="mt-5 text-center text-xs text-neutral-500">
        Already registered?{' '}
        <Link href="/login" className="text-amber-600 font-semibold hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  )
}
