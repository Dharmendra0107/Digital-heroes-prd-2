'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    if (process.env.NODE_ENV !== 'production') {
      const response = await fetch('/api/demo-auth', { method: 'DELETE' })
      if (response.ok) {
        router.push('/')
        router.refresh()
        return
      }
    }

    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navLinks = [
    { href: '/products', label: 'Products' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/pricing', label: 'Pricing' },
  ]

  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <span className="text-amber-500">▲</span>
            <span>Digital Heroes</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  pathname.startsWith(link.href)
                    ? 'text-amber-500'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Auth actions */}
          <div className="hidden md:flex items-center gap-3">
            <HeaderAuthButtons onSignOut={handleSignOut} pathname={pathname} />
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-neutral-600"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-neutral-200 bg-white px-4 py-4 space-y-3">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="block text-sm font-medium text-neutral-700 hover:text-amber-500"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-neutral-100">
            <HeaderAuthButtons onSignOut={handleSignOut} pathname={pathname} mobile />
          </div>
        </div>
      )}
    </header>
  )
}

function HeaderAuthButtons({
  onSignOut,
  pathname,
  mobile,
}: {
  onSignOut: () => void
  pathname: string
  mobile?: boolean
}) {
  const [authState, setAuthState] = useState<{
    pathname: string
    user: { email?: string } | null
    isAdmin: boolean
  } | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadAuthState() {
      let user: { email?: string } | null = null
      let isAdmin = false

      try {
        if (process.env.NODE_ENV !== 'production') {
          const response = await fetch('/api/demo-auth', { cache: 'no-store' })
          if (response.ok) {
            const result = (await response.json()) as {
              user?: { email: string; role: string } | null
            }
            if (result.user) {
              user = { email: result.user.email }
              isAdmin = result.user.role === 'admin'
            }
          } else {
            const supabase = createSupabaseBrowserClient()
            const { data } = await supabase.auth.getUser()
            if (data.user) {
              user = { email: data.user.email }
              const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single()
              isAdmin = profile?.role === 'admin'
            }
          }
        } else {
          const supabase = createSupabaseBrowserClient()
          const { data } = await supabase.auth.getUser()
          if (data.user) {
            user = { email: data.user.email }
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', data.user.id)
              .single()
            isAdmin = profile?.role === 'admin'
          }
        }
      } catch (error) {
        console.error('[HeaderAuthButtons] failed to load auth state:', error)
      } finally {
        if (mounted) setAuthState({ pathname, user, isAdmin })
      }
    }

    void loadAuthState()
    return () => {
      mounted = false
    }
  }, [pathname])

  if (!authState || authState.pathname !== pathname) return null

  const { user, isAdmin } = authState

  if (user) {
    return (
      <div className={`flex ${mobile ? 'flex-col gap-2' : 'items-center gap-3'}`}>
        {isAdmin && (
          <Link href="/admin" className="text-sm text-amber-600 font-medium hover:underline">
            Admin
          </Link>
        )}
        <Link
          href="/dashboard"
          className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
        >
          Dashboard
        </Link>
        <button
          onClick={onSignOut}
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className={`flex ${mobile ? 'flex-col gap-2' : 'items-center gap-3'}`}>
      <Link href="/login" className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
        Log in
      </Link>
      <Link
        href="/signup"
        className="text-sm font-medium bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors"
      >
        Get started
      </Link>
    </div>
  )
}
