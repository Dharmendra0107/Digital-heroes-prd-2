import { type NextRequest } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { isRazorpayConfigured, razorpayRequest, verifyRazorpayCheckoutSignature, type RazorpayPayment } from '@/lib/razorpay'

interface VerifyPaymentBody {
  razorpay_order_id?: unknown
  razorpay_payment_id?: unknown
  razorpay_signature?: unknown
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (isDemoAuthEnabled()) {
    return Response.json({ error: 'Payment verification is unavailable in demo mode' }, { status: 400 })
  }
  if (!isRazorpayConfigured()) {
    return Response.json({ error: 'Razorpay is not configured' }, { status: 503 })
  }

  const session = await getAppSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'customer') {
    return Response.json({ error: 'Only customers can pay for orders' }, { status: 403 })
  }

  let body: VerifyPaymentBody
  try {
    body = (await request.json()) as VerifyPaymentBody
  } catch {
    return Response.json({ error: 'Invalid payment response' }, { status: 400 })
  }

  const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body
  if (
    typeof razorpayOrderId !== 'string' ||
    typeof paymentId !== 'string' ||
    typeof signature !== 'string'
  ) {
    return Response.json({ error: 'Payment response is incomplete' }, { status: 400 })
  }

  if (!verifyRazorpayCheckoutSignature(razorpayOrderId, paymentId, signature)) {
    return Response.json({ error: 'Payment signature verification failed' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id,customer_id,status,total_price,razorpay_order_id,razorpay_payment_id')
    .eq('id', id)
    .maybeSingle()

  if (orderError) {
    console.error('[payment verification] order lookup failed:', orderError)
    return Response.json({ error: 'Could not verify the order' }, { status: 500 })
  }
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
  if (order.customer_id !== session.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (order.status !== 'pending_payment') {
    if (
      order.razorpay_payment_id === paymentId &&
      order.status !== 'cancelled'
    ) {
      return Response.json({ success: true, status: order.status })
    }
    return Response.json({ error: 'Order is no longer awaiting payment' }, { status: 409 })
  }
  if (order.razorpay_order_id !== razorpayOrderId) {
    return Response.json({ error: 'Payment does not match this order' }, { status: 400 })
  }

  const expectedAmount = Math.round(Number(order.total_price) * 100)
  let payment: RazorpayPayment
  try {
    payment = await razorpayRequest<RazorpayPayment>(
      `/payments/${encodeURIComponent(paymentId)}`,
      { method: 'GET' }
    )

    if (
      payment.order_id !== razorpayOrderId ||
      payment.amount !== expectedAmount ||
      payment.currency !== 'INR'
    ) {
      return Response.json({ error: 'Payment details do not match the order total' }, { status: 400 })
    }

    if (payment.status === 'authorized') {
      try {
        payment = await razorpayRequest<RazorpayPayment>(
          `/payments/${encodeURIComponent(paymentId)}/capture`,
          {
            method: 'POST',
            body: JSON.stringify({ amount: expectedAmount, currency: 'INR' }),
          }
        )
      } catch (captureError) {
        const latestPayment = await razorpayRequest<RazorpayPayment>(
          `/payments/${encodeURIComponent(paymentId)}`,
          { method: 'GET' }
        )
        if (latestPayment.status !== 'captured') throw captureError
        payment = latestPayment
      }
    }
  } catch (error) {
    console.error('[payment verification] Razorpay payment lookup/capture failed:', error)
    return Response.json({ error: 'Could not confirm payment with Razorpay' }, { status: 502 })
  }

  if (payment.status !== 'captured') {
    return Response.json({ error: 'Payment has not been captured yet' }, { status: 409 })
  }

  const adminClient = createSupabaseAdminClient()
  const { data: updatedOrder, error: updateError } = await adminClient
    .from('orders')
    .update({
      status: 'artwork_pending',
      razorpay_payment_id: paymentId,
    })
    .eq('id', id)
    .eq('customer_id', session.userId)
    .eq('status', 'pending_payment')
    .eq('razorpay_order_id', razorpayOrderId)
    .select('id')
    .maybeSingle()

  if (updateError) {
    console.error('[payment verification] failed to update paid order:', updateError)
    return Response.json({ error: 'Payment succeeded, but the order status could not be updated' }, { status: 500 })
  }

  if (!updatedOrder) {
    const { data: currentOrder, error: currentOrderError } = await adminClient
      .from('orders')
      .select('status,razorpay_payment_id')
      .eq('id', id)
      .eq('customer_id', session.userId)
      .maybeSingle()

    if (currentOrderError) {
      console.error('[payment verification] failed to confirm updated order:', currentOrderError)
      return Response.json({ error: 'Payment succeeded, but order status is being confirmed' }, { status: 500 })
    }
    if (
      currentOrder?.razorpay_payment_id !== paymentId ||
      currentOrder.status === 'pending_payment' ||
      currentOrder.status === 'cancelled'
    ) {
      return Response.json({ error: 'Order changed while payment was being verified' }, { status: 409 })
    }
  }

  return Response.json({ success: true, status: 'artwork_pending' })
}
