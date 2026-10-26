import { NextRequest, NextResponse } from 'next/server'
import { getAppSession } from '@/lib/app-session'
import {
  DEMO_SESSION_COOKIE,
  isDemoAuthEnabled,
  signDemoSession,
} from '@/lib/demo-auth'
import { getDemoSession } from '@/lib/demo-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const session = await getAppSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return Response.json({
    email: session.email,
    full_name: session.name,
    company: session.company,
  })
}

export async function PATCH(request: NextRequest) {
  const session = await getAppSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const fullName =
    'full_name' in body && typeof body.full_name === 'string'
      ? body.full_name.trim()
      : ''
  const company =
    'company' in body && typeof body.company === 'string'
      ? body.company.trim()
      : ''
  if (!fullName || fullName.length > 100 || company.length > 120) {
    return Response.json(
      { error: 'Name is required (up to 100 characters); company can be up to 120 characters.' },
      { status: 400 }
    )
  }

  if (isDemoAuthEnabled()) {
    const demoSession = await getDemoSession()
    const secret = process.env.DEMO_AUTH_SECRET
    if (!demoSession || !secret) {
      console.error('[profile PATCH] demo session signing is not configured')
      return Response.json({ error: 'Could not update the demo profile' }, { status: 500 })
    }

    const token = await signDemoSession(
      { ...demoSession, name: fullName, company },
      secret
    )
    const response = NextResponse.json({
      email: demoSession.email,
      full_name: fullName,
      company,
    })
    response.cookies.set(DEMO_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: Math.max(0, Math.floor((demoSession.expiresAt - Date.now()) / 1000)),
    })
    return response
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, company })
    .eq('id', user.id)
    .select('email, full_name, company')
    .single()
  if (error) {
    console.error('[profile PATCH] profile update failed:', error)
    return Response.json({ error: 'Could not save profile changes' }, { status: 500 })
  }

  return Response.json(data)
}
