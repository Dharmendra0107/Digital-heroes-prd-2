import { NextRequest, NextResponse } from 'next/server'
import { DEMO_ACCOUNTS } from '@/lib/demo-auth-credentials'
import {
  DEMO_SESSION_COOKIE,
  isDemoAuthEnabled,
  signDemoSession,
  type DemoSession,
} from '@/lib/demo-auth'
import { getDemoSession } from '@/lib/demo-session'

export async function GET() {
  if (!isDemoAuthEnabled()) {
    return NextResponse.json({ error: 'Local demo authentication is disabled' }, { status: 404 })
  }

  const session = await getDemoSession()
  return NextResponse.json({
    user: session
      ? { email: session.email, role: session.role }
      : null,
  })
}

export async function POST(request: NextRequest) {
  if (!isDemoAuthEnabled()) {
    return NextResponse.json({ error: 'Local demo authentication is disabled' }, { status: 404 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const body = rawBody as { email?: unknown; password?: unknown }

  const account = Object.values(DEMO_ACCOUNTS).find(
    (candidate) => candidate.email === body.email && candidate.password === body.password
  )
  if (!account) {
    return NextResponse.json({ error: 'Invalid demo email or password' }, { status: 401 })
  }

  const secret = process.env.DEMO_AUTH_SECRET
  if (!secret) {
    console.error('[demo-auth] DEMO_AUTH_SECRET is missing')
    return NextResponse.json({ error: 'Local demo authentication is not configured' }, { status: 500 })
  }

  const session: DemoSession = {
    userId: account.userId,
    email: account.email,
    name: account.name,
    company: account.company,
    role: account.role,
    expiresAt: Date.now() + 12 * 60 * 60 * 1000,
  }

  const token = await signDemoSession(session, secret)
  const response = NextResponse.json({ role: account.role })
  response.cookies.set(DEMO_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 12 * 60 * 60,
  })

  return response
}

export async function DELETE() {
  if (!isDemoAuthEnabled()) {
    return NextResponse.json({ error: 'Local demo authentication is disabled' }, { status: 404 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(DEMO_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 0,
  })
  return response
}
