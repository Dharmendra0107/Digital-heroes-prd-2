import { type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { randomUUID } from 'node:crypto'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { readDemoStore, updateDemoStore } from '@/lib/demo-store'
import { notifyProofReady } from '@/lib/email/notifications'

// ----------------------------------------------------------------
// POST /api/proofs — Create a new proof for an order (admin only)
// ----------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (isDemoAuthEnabled()) {
    const session = await getAppSession()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const orderId =
      typeof body === 'object' && body !== null && 'order_id' in body
        ? body.order_id
        : undefined
    const fileUrl =
      typeof body === 'object' && body !== null && 'file_url' in body
        ? body.file_url
        : undefined
    const thumbnailUrl =
      typeof body === 'object' && body !== null && 'thumbnail_url' in body
        ? body.thumbnail_url
        : undefined

    if (typeof orderId !== 'string' || !orderId || typeof fileUrl !== 'string' || !fileUrl) {
      return Response.json({ error: 'order_id and file_url are required' }, { status: 400 })
    }
    if (thumbnailUrl !== undefined && typeof thumbnailUrl !== 'string') {
      return Response.json({ error: 'thumbnail_url must be a string' }, { status: 400 })
    }

    try {
      const result = updateDemoStore((store) => {
        const order = store.orders.find((item) => item.id === orderId)
        if (!order) return null

        const version =
          Math.max(
            0,
            ...store.proofs
              .filter((proof) => proof.order_id === orderId)
              .map((proof) => proof.version)
          ) + 1
        const proof = {
          id: randomUUID(),
          order_id: orderId,
          version,
          file_url: fileUrl,
          ...(typeof thumbnailUrl === 'string' ? { thumbnail_url: thumbnailUrl } : {}),
          status: 'pending' as const,
          created_at: new Date().toISOString(),
        }

        store.proofs.unshift(proof)
        order.status = 'proof_sent'
        order.updated_at = proof.created_at
        return proof
      })
      if (!result) return Response.json({ error: 'Order not found' }, { status: 404 })
      const store = readDemoStore()
      const order = store.orders.find((item) => item.id === orderId)
      const notification = await notifyProofReady(
        order?.customer?.email || '',
        orderId,
        order?.customer?.full_name || 'Customer',
        result.version
      )
      return Response.json({ ...result, notification }, { status: 201 })
    } catch (error) {
      console.error('[proofs POST] failed to save local proof:', error)
      return Response.json({ error: 'Failed to create proof' }, { status: 500 })
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

  // Admin check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { order_id, file_url, thumbnail_url } = body as {
    order_id?: unknown
    file_url?: unknown
    thumbnail_url?: unknown
  }

  if (typeof order_id !== 'string' || !order_id || typeof file_url !== 'string' || !file_url) {
    return Response.json({ error: 'order_id and file_url are required' }, { status: 400 })
  }

  // Verify order exists
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, customer_id')
    .eq('id', order_id)
    .single()

  if (orderError || !order) {
    return Response.json({ error: 'Order not found' }, { status: 404 })
  }

  const adminClient = createSupabaseAdminClient()

  // Get current max version for this order
  const { data: existing } = await adminClient
    .from('proofs')
    .select('version')
    .eq('order_id', order_id)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = existing ? existing.version + 1 : 1

  // Create proof
  const { data: proof, error: proofError } = await adminClient
    .from('proofs')
    .insert({
      order_id,
      version: nextVersion,
      file_url,
      thumbnail_url: thumbnail_url ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (proofError) {
    console.error('[proofs POST] insert error:', proofError)
    return Response.json({ error: 'Failed to create proof' }, { status: 500 })
  }

  // Update order status to proof_sent
  await adminClient
    .from('orders')
    .update({ status: 'proof_sent' })
    .eq('id', order_id)

  const { data: customer, error: customerError } = await adminClient
    .from('profiles')
    .select('email, full_name')
    .eq('id', order.customer_id)
    .maybeSingle()
  if (customerError) {
    console.error('[proofs POST] customer notification lookup failed:', customerError)
  }
  const notification = await notifyProofReady(
    customer?.email || '',
    order_id,
    customer?.full_name || 'Customer',
    proof.version
  )

  return Response.json({ ...proof, notification }, { status: 201 })
}
