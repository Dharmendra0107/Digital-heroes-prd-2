import { type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { updateDemoStore } from '@/lib/demo-store'

// ----------------------------------------------------------------
// POST /api/proofs/[id]/approve — Customer approves a proof
// ----------------------------------------------------------------
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (isDemoAuthEnabled()) {
    const session = await getAppSession()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'customer') return Response.json({ error: 'Forbidden' }, { status: 403 })

    const result: { error?: string; proof?: unknown } = {}
    const now = new Date().toISOString()
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
          result.error = `Proof cannot be approved — current status: ${proof.status}`
          return
        }
        proof.status = 'approved'
        proof.approved_by = session.userId
        proof.approved_at = now
        order.status = 'proof_approved'
        order.updated_at = now
        result.proof = proof
      })
    } catch (error) {
      console.error('[proofs approve] failed to update local demo proof:', error)
      return Response.json({ error: 'Failed to approve local demo proof' }, { status: 500 })
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

  // Fetch proof
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
      { error: `Proof cannot be approved — current status: ${proof.status}` },
      { status: 400 }
    )
  }

  const adminClient = createSupabaseAdminClient()

  // Update proof
  const { data: updated, error: updateError } = await adminClient
    .from('proofs')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    console.error('[proofs approve] update error:', updateError)
    return Response.json({ error: 'Failed to approve proof' }, { status: 500 })
  }

  // Update order status
  await adminClient
    .from('orders')
    .update({ status: 'proof_approved' })
    .eq('id', proof.order_id)

  return Response.json(updated)
}
