import { type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { updateDemoStore } from '@/lib/demo-store'

// ----------------------------------------------------------------
// POST /api/proofs/[id]/revision — Customer requests revision
// ----------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (isDemoAuthEnabled()) {
    const session = await getAppSession()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'customer') return Response.json({ error: 'Forbidden' }, { status: 403 })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const changeNotes =
      typeof body === 'object' && body !== null && 'change_notes' in body
        ? body.change_notes
        : undefined
    if (typeof changeNotes !== 'string' || !changeNotes.trim()) {
      return Response.json({ error: 'change_notes is required' }, { status: 400 })
    }

    const result: { error?: string; proof?: unknown } = {}
    try {
      updateDemoStore((store) => {
        const proof = store.proofs.find((item) => item.id === id)
        if (!proof) {
          result.error = 'Proof not found'
          return
        }
        const order = store.orders.find((item) => item.id === proof.order_id)
        if (!order || order.customer_id !== session.userId) {
          result.error = 'Forbidden'
          return
        }
        if (proof.status !== 'pending') {
          result.error = `Revision cannot be requested — current status: ${proof.status}`
          return
        }
        proof.status = 'revision_requested'
        proof.change_notes = changeNotes.trim().slice(0, 2000)
        order.status = 'artwork_pending'
        order.updated_at = new Date().toISOString()
        result.proof = proof
      })
    } catch (error) {
      console.error('[proofs revision] failed to update local demo proof:', error)
      return Response.json({ error: 'Failed to request local demo revision' }, { status: 500 })
    }
    if (result.error === 'Proof not found') {
      return Response.json({ error: result.error }, { status: 404 })
    }
    if (result.error === 'Forbidden') {
      return Response.json({ error: result.error }, { status: 403 })
    }
    if (result.error) return Response.json({ error: result.error }, { status: 400 })
    return Response.json(result.proof)
  }

  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { change_notes } = body as { change_notes?: unknown }

  if (typeof change_notes !== 'string' || !change_notes.trim()) {
    return Response.json({ error: 'change_notes is required' }, { status: 400 })
  }

  // Fetch proof with order ownership info
  const { data: proof, error: proofError } = await supabase
    .from('proofs')
    .select('*, order:orders(customer_id)')
    .eq('id', id)
    .single()

  if (proofError || !proof) {
    return Response.json({ error: 'Proof not found' }, { status: 404 })
  }

  // Verify order ownership
  const order = proof.order as { customer_id: string } | null
  if (!order || order.customer_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (proof.status !== 'pending') {
    return Response.json(
      { error: `Revision cannot be requested — current status: ${proof.status}` },
      { status: 400 }
    )
  }

  const adminClient = createSupabaseAdminClient()

  // Update proof status
  const { data: updated, error: updateError } = await adminClient
    .from('proofs')
    .update({
      status: 'revision_requested',
      change_notes: change_notes.trim(),
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    console.error('[proofs revision] update error:', updateError)
    return Response.json({ error: 'Failed to request revision' }, { status: 500 })
  }

  // Revert order status to artwork_pending
  await adminClient
    .from('orders')
    .update({ status: 'artwork_pending' })
    .eq('id', proof.order_id)

  return Response.json(updated)
}
