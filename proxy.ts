import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  DEMO_SESSION_COOKIE,
  isDemoAuthEnabled,
  verifyDemoSession,
} from '@/lib/demo-auth'

// Routes that require authentication
const CUSTOMER_ROUTES = ['/dashboard', '/orders', '/designer', '/proofs', '/products']
const ADMIN_ROUTES = ['/admin']
const AUTH_ROUTES = ['/login', '/signup', '/admin/login']

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set(
    'next',
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  )
  return NextResponse.redirect(loginUrl)
}

function redirectToSubscribe(request: NextRequest) {
  const subscribeUrl = new URL('/subscribe', request.url)
  subscribeUrl.searchParams.set(
    'next',
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  )
  return NextResponse.redirect(subscribeUrl)
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next({ request })

  if (isDemoAuthEnabled()) {
    const secret = process.env.DEMO_AUTH_SECRET
    if (!secret) {
      console.error('[proxy] DEMO_AUTH_SECRET is missing')
      return NextResponse.json({ error: 'Local demo authentication is not configured' }, { status: 500 })
    }

    const token = request.cookies.get(DEMO_SESSION_COOKIE)?.value
    const demoSession = token ? await verifyDemoSession(token, secret) : null
    const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))
    const isCustomerRoute = CUSTOMER_ROUTES.some((route) => pathname.startsWith(route))
    const isAdminRoute =
      pathname !== '/admin/login' &&
      ADMIN_ROUTES.some((route) => pathname.startsWith(route))

    if (demoSession && isAuthRoute) {
      const destination = demoSession.role === 'admin' ? '/admin/dashboard' : '/dashboard'
      return NextResponse.redirect(new URL(destination, request.url))
    }

    if (isAdminRoute && demoSession?.role !== 'admin') {
      const destination = demoSession ? '/dashboard' : `/login?next=${pathname}`
      return NextResponse.redirect(new URL(destination, request.url))
    }

    if (isCustomerRoute && !demoSession) {
      return redirectToLogin(request)
    }

    return response
  }

  // AdminLayout verifies the session and role before rendering admin content.
  if (
    pathname !== '/admin/login' &&
    !pathname.startsWith('/admin/login/') &&
    ADMIN_ROUTES.some((route) => pathname.startsWith(route))
  ) {
    return response
  }

  // Create Supabase client using cookies
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect logged-in users away from auth pages
  if (user && AUTH_ROUTES.some(r => pathname.startsWith(r))) {
    let destination = '/dashboard'
    if (pathname === '/admin/login') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role === 'admin') destination = '/admin/dashboard'
    }
    return NextResponse.redirect(new URL(destination, request.url))
  }

  // Protect customer routes
  if (CUSTOMER_ROUTES.some(r => pathname.startsWith(r)) && !user) {
    return redirectToLogin(request)
  }

  if (
    user &&
    (pathname === '/products' || pathname.startsWith('/products/'))
  ) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('[proxy] failed to load product-route profile:', profileError)
      return NextResponse.json({ error: 'Could not verify account access' }, { status: 500 })
    }

    if (profile?.role !== 'admin') {
      const { data: subscription, error: subscriptionError } = await supabase
        .from('customer_subscriptions')
        .select('id')
        .eq('customer_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (subscriptionError) {
        console.error('[proxy] failed to verify subscription access:', subscriptionError)
        return NextResponse.json({ error: 'Could not verify subscription access' }, { status: 500 })
      }

      if (!subscription) return redirectToSubscribe(request)
    }
  }

  // Protect admin routes — check role from profile
  if (
    pathname !== '/admin/login' &&
    ADMIN_ROUTES.some(r => pathname.startsWith(r))
  ) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|images|api/webhooks).*)',
  ],
}
