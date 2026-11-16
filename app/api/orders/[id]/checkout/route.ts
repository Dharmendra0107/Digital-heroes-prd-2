import { type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { updateDemoStore } from '@/lib/demo-store'
import {
  isRazorpayConfigured,
  razorpayRequest,
  type RazorpayOrder,
} from '@/lib/razorpay'

// ----------------------------------------------------------------
// POST /api/orders/[id]/checkout — Create or reuse a Razorpay order
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

  if (!isRazorpayConfigured()) {
    return Response.json(
      { error: 'Razorpay is not configured yet. Please contact support.' },
      { status: 503 }
    )
  }

  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id,customer_id,status,total_price,razorpay_order_id,product:products(name)'
    )
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return Response.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.customer_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (order.status !== 'pending_payment') {
    return Response.json(
      { error: `Order is not in pending_payment status (current: ${order.status})` },
      { status: 400 }
    )
  }

  const amount = Math.round(Number(order.total_price) * 100)
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return Response.json({ error: 'Order total is invalid for payment' }, { status: 400 })
  }
  const productName = order.product?.[0]?.name || 'Custom Print Order'

  let razorpayOrder: RazorpayOrder
  try {
    if (order.razorpay_order_id) {
      const existingOrder = await razorpayRequest<RazorpayOrder>(
        `/orders/${encodeURIComponent(order.razorpay_order_id)}`,
        { method: 'GET' }
      )

      if (existingOrder.status === 'paid') {
        return Response.json(
          { error: 'Payment is already processing. Refresh the order shortly.' },
          { status: 409 }
        )
      }
      if (
        existingOrder.amount !== amount ||
        existingOrder.currency !== 'INR' ||
        !['created', 'attempted'].includes(existingOrder.status)
      ) {
        return Response.json(
          { error: 'The existing payment attempt cannot be reused. Please contact support.' },
          { status: 409 }
        )
      }
      razorpayOrder = existingOrder
    } else {
      razorpayOrder = await razorpayRequest<RazorpayOrder>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          amount,
          currency: 'INR',
          receipt: id,
          notes: {
            order_id: id,
            customer_id: user.id,
          },
        }),
      })
      if (
        razorpayOrder.amount !== amount ||
        razorpayOrder.currency !== 'INR' ||
        !razorpayOrder.id
      ) {
        throw new Error('Razorpay created an order with unexpected payment details')
      }
    }
  } catch (err) {
    console.error('[checkout] Razorpay order creation failed:', err)
    return Response.json({ error: 'Could not start Razorpay checkout' }, { status: 502 })
  }

  const adminClient = createSupabaseAdminClient()
  const paymentOrderUpdate = adminClient
    .from('orders')
    .update({ razorpay_order_id: razorpayOrder.id })
    .eq('id', id)
    .eq('customer_id', user.id)
    .eq('status', 'pending_payment')
  const { data: updatedOrder, error: updateError } = order.razorpay_order_id
    ? await paymentOrderUpdate
        .eq('razorpay_order_id', order.razorpay_order_id)
        .select('id')
        .maybeSingle()
    : await paymentOrderUpdate
        .is('razorpay_order_id', null)
        .select('id')
        .maybeSingle()

  if (updateError) {
    console.error('[checkout] failed to save Razorpay order id:', updateError)
    return Response.json({ error: 'Could not save payment details' }, { status: 500 })
  }
  if (!updatedOrder) {
    return Response.json(
      { error: 'Order changed while payment was starting. Refresh and try again.' },
      { status: 409 }
    )
  }

  return Response.json({
    keyId: process.env.RAZORPAY_KEY_ID,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    razorpayOrderId: razorpayOrder.id,
    name: 'Digital Heroes',
    description: productName,
    prefillEmail: user.email ?? '',
  })
}
