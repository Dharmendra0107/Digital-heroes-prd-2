import { type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { readDemoStore, updateDemoStore, type DemoOrder } from '@/lib/demo-store'
import type { OrderStatus } from '@/types'
import { notifyOrderCompleted } from '@/lib/email/notifications'

const ORDER_STATUSES: OrderStatus[] = [
  'pending_payment',
  'paid',
  'artwork_pending',
  'proof_sent',
  'proof_approved',
  'in_production',
  'completed',
  'cancelled',
]

// ----------------------------------------------------------------
// GET /api/orders/[id] — Get a single order with related data
// ----------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (isDemoAuthEnabled()) {
    const session = await getAppSession()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    try {
      const store = readDemoStore()
      const order = store.orders.find((item) => item.id === id)
      if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
      if (session.role !== 'admin' && order.customer_id !== session.userId) {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
      return Response.json({
        ...order,
        design: store.designs.find((item) => item.order_id === id) ?? null,
        proofs: store.proofs.filter((item) => item.order_id === id),
        print_files: store.printFiles.filter((item) => item.order_id === id),
      })
    } catch (error) {
      console.error('[orders GET detail] failed to read local demo order:', error)
      return Response.json({ error: 'Failed to fetch local demo order' }, { status: 500 })
    }
  }

  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch order with full related data
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      product:products(*),
      design:designs(*),
      proofs(*),
      print_files(*)
    `)
    .eq('id', id)
    .single()

  if (error || !order) {
    return Response.json({ error: 'Order not found' }, { status: 404 })
  }

  // Check ownership or admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  if (!isAdmin && order.customer_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  return Response.json(order)
}

// ----------------------------------------------------------------
// PATCH /api/orders/[id] — Update order status (Admin or authorized owner)
// ----------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (isDemoAuthEnabled()) {
    const session = await getAppSession()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const status =
      typeof body === 'object' && body !== null && 'status' in body
        ? body.status
        : undefined
    if (typeof status !== 'string' || !ORDER_STATUSES.includes(status as OrderStatus)) {
      return Response.json({ error: 'Missing or invalid status' }, { status: 400 })
    }

    let updated: { order: DemoOrder } | null = null
    let completionEmail:
      | { recipient: string; customerName: string; wasCompleted: boolean }
      | undefined
    try {
      updated = updateDemoStore((store) => {
        const order = store.orders.find((item) => item.id === id)
        if (!order) return null
        const wasCompleted = order.status === 'completed'
        order.status = status as OrderStatus
        order.updated_at = new Date().toISOString()
        completionEmail = {
          recipient: order.customer?.email || '',
          customerName: order.customer?.full_name || 'Customer',
          wasCompleted,
        }
        return { order }
      })
    } catch (error) {
      console.error('[orders PATCH] failed to update local demo order:', error)
      return Response.json({ error: 'Failed to update local demo order' }, { status: 500 })
    }
    if (!updated) return Response.json({ error: 'Order not found' }, { status: 404 })
    const notification =
      status === 'completed' && completionEmail && !completionEmail.wasCompleted
        ? await notifyOrderCompleted(
            completionEmail.recipient,
            id,
            completionEmail.customerName
          )
        : undefined
    return Response.json({ success: true, order: updated.order, notification })
  }

  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const status = typeof body.status === 'string' ? body.status : ''
  if (!ORDER_STATUSES.includes(status as OrderStatus)) {
    return Response.json({ error: 'Missing or invalid status' }, { status: 400 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profileError) {
    console.error('[orders PATCH] failed to load user role:', profileError)
    return Response.json({ error: 'Could not verify administrator access' }, { status: 500 })
  }
  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Only administrators can update order status' }, { status: 403 })
  }

  const { createSupabaseAdminClient } = await import('@/lib/supabase/server')
  const adminClient = createSupabaseAdminClient()

  const { data: previousOrder, error: previousOrderError } = await adminClient
    .from('orders')
    .select('status, customer_id')
    .eq('id', id)
    .maybeSingle()
  if (previousOrderError) {
    console.error('[orders PATCH] prior status lookup failed:', previousOrderError)
    return Response.json({ error: 'Could not load the order status' }, { status: 500 })
  }
  if (!previousOrder) return Response.json({ error: 'Order not found' }, { status: 404 })

  const { data: updated, error } = await adminClient
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[orders PATCH] update error:', error)
    return Response.json({ error: 'Failed to update order status' }, { status: 500 })
  }

  let notification
  if (status === 'completed' && previousOrder.status !== 'completed') {
    const { data: customer, error: customerError } = await adminClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', previousOrder.customer_id)
      .maybeSingle()
    if (customerError) {
      console.error('[orders PATCH] completion notification lookup failed:', customerError)
    }
    notification = await notifyOrderCompleted(
      customer?.email || '',
      id,
      customer?.full_name || 'Customer'
    )
  }

  return Response.json({ success: true, order: updated, notification })
}
