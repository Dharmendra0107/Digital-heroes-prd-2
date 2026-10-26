import { type NextRequest } from 'next/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

const USER_ROLES: UserRole[] = ['customer', 'admin']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAppSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })
  if (isDemoAuthEnabled()) {
    return Response.json(
      { error: 'Configure Supabase to edit users; demo accounts are read-only.' },
      { status: 501 }
    )
  }

  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const update: { full_name?: string; company?: string | null; role?: UserRole } = {}
  if ('full_name' in body) {
    if (typeof body.full_name !== 'string' || !body.full_name.trim() || body.full_name.trim().length > 100) {
      return Response.json({ error: 'Full name is required and must be at most 100 characters' }, { status: 400 })
    }
    update.full_name = body.full_name.trim()
  }
  if ('company' in body) {
    if (typeof body.company !== 'string' || body.company.trim().length > 120) {
      return Response.json({ error: 'Company must be at most 120 characters' }, { status: 400 })
    }
    update.company = body.company.trim() || null
  }
  if ('role' in body) {
    if (typeof body.role !== 'string' || !USER_ROLES.includes(body.role as UserRole)) {
      return Response.json({ error: 'Role must be customer or admin' }, { status: 400 })
    }
    update.role = body.role as UserRole
  }
  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'No editable user fields were provided' }, { status: 400 })
  }

  const adminClient = createSupabaseAdminClient()
  const { data: target, error: targetError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', id)
    .maybeSingle()
  if (targetError) {
    console.error('[admin users PATCH] target lookup failed:', targetError)
    return Response.json({ error: 'Could not load the user profile' }, { status: 500 })
  }
  if (!target) return Response.json({ error: 'User not found' }, { status: 404 })

  if (target.role === 'admin' && update.role === 'customer') {
    const { count, error: countError } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
    if (countError) {
      console.error('[admin users PATCH] administrator count failed:', countError)
      return Response.json({ error: 'Could not verify administrator count' }, { status: 500 })
    }
    if ((count ?? 0) <= 1) {
      return Response.json({ error: 'The last administrator cannot be changed to a customer' }, { status: 409 })
    }
  }

  const { data, error } = await adminClient
    .from('profiles')
    .update(update)
    .eq('id', id)
    .select('id, email, full_name, company, role, created_at')
    .single()
  if (error) {
    console.error('[admin users PATCH] profile update failed:', error)
    return Response.json({ error: 'Could not save user changes' }, { status: 500 })
  }
  return Response.json({ user: data })
}
