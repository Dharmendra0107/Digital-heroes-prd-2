import { type NextRequest } from 'next/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

interface ProductUpdate {
  name?: string
  description?: string
  base_price_per_unit?: number
  active?: boolean
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAppSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })
  if (isDemoAuthEnabled()) {
    return Response.json(
      { error: 'Configure Supabase to edit products; demo products are read-only.' },
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

  const update: ProductUpdate = {}
  if ('name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) {
      return Response.json({ error: 'Product name is required and must be at most 120 characters' }, { status: 400 })
    }
    update.name = body.name.trim()
  }
  if ('description' in body) {
    if (typeof body.description !== 'string' || body.description.trim().length > 2000) {
      return Response.json({ error: 'Description must be at most 2,000 characters' }, { status: 400 })
    }
    update.description = body.description.trim()
  }
  if ('base_price_per_unit' in body) {
    if (
      typeof body.base_price_per_unit !== 'number' ||
      !Number.isFinite(body.base_price_per_unit) ||
      body.base_price_per_unit <= 0 ||
      body.base_price_per_unit > 1_000_000
    ) {
      return Response.json({ error: 'Base price must be greater than ₹0 and at most ₹10,00,000' }, { status: 400 })
    }
    update.base_price_per_unit = body.base_price_per_unit
  }
  if ('active' in body) {
    if (typeof body.active !== 'boolean') {
      return Response.json({ error: 'Active must be true or false' }, { status: 400 })
    }
    update.active = body.active
  }
  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'No editable product fields were provided' }, { status: 400 })
  }

  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('products')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) {
    console.error('[admin products PATCH] update failed:', error)
    return Response.json({ error: 'Could not save product changes' }, { status: 500 })
  }
  if (!data) return Response.json({ error: 'Product not found' }, { status: 404 })
  return Response.json({ product: data })
}
