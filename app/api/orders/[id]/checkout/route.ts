import { type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { updateDemoStore } from '@/lib/demo-store'

// ----------------------------------------------------------------
// POST /api/orders/[id]/checkout — Create Stripe checkout session
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

    const now = new Date().toISOString()
    const result: { error?: string } = {}
    try {
      updateDemoStore((store) => {
        const order = store.orders.find((item) => item.id === id)
        if (!order) {
          result.error = 'Order not found'
        } else if (order.customer_id !== session.userId) {
          result.error = 'Forbidden'
        } else if (order.status !== 'pending_payment') {
          result.error = `Order is not in pending_payment status (current: ${order.status})`
        } else {
          order.status = 'artwork_pending'
          order.updated_at = now
        }
      })
    } catch (error) {
      console.error('[checkout] failed to update local demo order:', error)
      return Response.json({ error: 'Failed to update local demo order' }, { status: 500 })
    }

    if (result.error === 'Order not found') {
      return Response.json({ error: result.error }, { status: 404 })
    }
    if (result.error) return Response.json({ error: result.error }, { status: 400 })

    return Response.json({
      demo: true,
      message: 'Demo checkout completed. No payment was collected.',
    })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch the order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, product:products(*)')
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return Response.json({ error: 'Order not found' }, { status: 404 })
  }

  // Verify ownership
  if (order.customer_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Order must be in pending_payment state
  if (order.status !== 'pending_payment') {
    return Response.json(
      { error: `Order is not in pending_payment status (current: ${order.status})` },
      { status: 400 }
    )
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  const productName = order.product?.name ?? 'Custom Print Order'
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'inr',
            unit_amount: Math.round(order.total_price * 100), // paisa
            product_data: {
              name: productName,
              description: `Qty: ${order.quantity}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { order_id: id },
      success_url: `${baseUrl}/orders/${id}?success=true`,
      cancel_url: `${baseUrl}/orders/${id}`,
    })
  } catch (err) {
    console.error('[checkout] Stripe session creation failed:', err)
    return Response.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }

  // Persist stripe session ID
  const adminClient = createSupabaseAdminClient()
  await adminClient
    .from('orders')
    .update({ stripe_session_id: session.id })
    .eq('id', id)

  return Response.json({ url: session.url })
}
