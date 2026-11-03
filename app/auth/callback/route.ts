import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function getSafeNextPath(value: string | null, origin: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/dashboard'
  }

  try {
    const destination = new URL(value, origin)
    return destination.origin === origin
      ? `${destination.pathname}${destination.search}${destination.hash}`
      : '/dashboard'
  } catch {
    return '/dashboard'
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const cookieStore = await cookies()
  const destination = getSafeNextPath(searchParams.get('next'), origin)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('[auth callback] Supabase public configuration is missing')
    return NextResponse.redirect(new URL('/login?authError=confirmation_failed', origin))
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })

  if (!code || searchParams.has('error')) {
    console.warn('[auth callback] Supabase returned an invalid or expired confirmation link')
    return NextResponse.redirect(new URL('/login?authError=confirmation_failed', origin))
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth callback] Failed to exchange confirmation code:', error.message)
    return NextResponse.redirect(new URL('/login?authError=confirmation_failed', origin))
  }

  return NextResponse.redirect(new URL(destination, origin))
}
