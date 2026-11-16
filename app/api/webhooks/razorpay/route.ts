import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay'
import { normalizeSubscriptionStatus, razorpayTimestampToIso } from '@/lib/subscriptions'

export const runtime = 'nodejs'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function statusForSubscriptionEvent(eventName: string, entityStatus: unknown) {
  const eventStatus: Record<string, string> = {
    'subscription.activated': 'active',
    'subscription.authenticated': 'authenticated',
    'subscription.charged': 'active',
    'subscription.pending': 'pending',
    'subscription.halted': 'halted',
    'subscription.paused': 'paused',
    'subscription.resumed': 'active',
    'subscription.cancelled': 'cancelled',
    'subscription.completed': 'completed',
    'subscription.expired': 'expired',
  }
  return normalizeSubscriptionStatus(eventStatus[eventName] ?? entityStatus)
}

async function handleSubscriptionEvent(
  eventName: string,
  payload: unknown,
  adminClient: ReturnType<typeof createSupabaseAdminClient>
) {
  const eventPayload = isRecord(payload) ? payload : null
  const subscriptionContainer =
    eventPayload && isRecord(eventPayload.subscription) ? eventPayload.subscription : null
  const subscription =
    subscriptionContainer && isRecord(subscriptionContainer.entity)
      ? subscriptionContainer.entity
      : null

  if (
    !subscription ||
    typeof subscription.id !== 'string' ||
    typeof subscription.plan_id !== 'string'
  ) {
    return Response.json({ error: 'Invalid subscription webhook payload' }, { status: 400 })
  }

  const status = statusForSubscriptionEvent(eventName, subscription.status)
  if (!status) {
    console.warn('[Razorpay Webhook] ignoring unsupported subscription status', {
      subscriptionId: subscription.id,
      eventName,
    })
    return Response.json({ received: true, ignored: true })
  }

  const { data: savedSubscription, error: lookupError } = await adminClient
    .from('customer_subscriptions')
    .select('id,razorpay_plan_id,status')
    .eq('razorpay_subscription_id', subscription.id)
    .maybeSingle()

  if (lookupError) {
    console.error('[Razorpay Webhook] subscription lookup failed:', lookupError)
    return Response.json({ error: 'Could not find the subscription' }, { status: 500 })
  }
  if (!savedSubscription) {
    console.error('[Razorpay Webhook] event has no matching subscription record', {
      subscriptionId: subscription.id,
    })
    return Response.json({ error: 'Subscription record is not ready' }, { status: 500 })
  }
  if (savedSubscription.razorpay_plan_id !== subscription.plan_id) {
    console.error('[Razorpay Webhook] subscription plan mismatch', {
      subscriptionId: subscription.id,
    })
    return Response.json({ error: 'Subscription plan does not match' }, { status: 400 })
  }
  if (
    ['cancelled', 'completed', 'expired'].includes(savedSubscription.status) ||
    (savedSubscription.status === 'active' &&
      ['created', 'authenticated', 'pending'].includes(status))
  ) {
    return Response.json({ received: true, ignored: true })
  }

  const { error: updateError } = await adminClient
    .from('customer_subscriptions')
    .update({
      status,
      current_start: razorpayTimestampToIso(subscription.current_start),
      current_end: razorpayTimestampToIso(subscription.current_end),
      charge_at: razorpayTimestampToIso(subscription.charge_at),
      ...(status === 'cancelled' || status === 'completed' || status === 'expired'
        ? { cancel_at_cycle_end: false }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', savedSubscription.id)

  if (updateError) {
    console.error('[Razorpay Webhook] failed to update subscription:', updateError)
    return Response.json({ error: 'Could not update the subscription' }, { status: 500 })
  }

  return Response.json({ received: true })
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured')
    return Response.json({ error: 'Webhook is not configured' }, { status: 500 })
  }

  const signature = request.headers.get('x-razorpay-signature')
  if (!signature) {
    return Response.json({ error: 'Missing Razorpay signature' }, { status: 400 })
  }

  const rawBody = await request.text()
  if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    return Response.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  let event: unknown
  try {
    event = JSON.parse(rawBody) as unknown
  } catch {
    return Response.json({ error: 'Invalid webhook payload' }, { status: 400 })
  }

  if (!isRecord(event) || typeof event.event !== 'string') {
    return Response.json({ error: 'Invalid webhook event' }, { status: 400 })
  }

  const adminClient = createSupabaseAdminClient()
  if (event.event.startsWith('subscription.')) {
    return handleSubscriptionEvent(event.event, event.payload, adminClient)
  }
  if (event.event !== 'payment.captured') {
    return Response.json({ received: true })
  }

  const payload = isRecord(event.payload) ? event.payload : null
  const paymentContainer = payload && isRecord(payload.payment) ? payload.payment : null
  const payment = paymentContainer && isRecord(paymentContainer.entity)
    ? paymentContainer.entity
    : null

  if (
    !payment ||
    typeof payment.id !== 'string' ||
    typeof payment.order_id !== 'string' ||
    typeof payment.amount !== 'number' ||
    typeof payment.currency !== 'string' ||
    payment.status !== 'captured'
  ) {
    return Response.json({ error: 'Invalid captured-payment payload' }, { status: 400 })
  }

  const { data: order, error: lookupError } = await adminClient
    .from('orders')
    .select('id,status,total_price,razorpay_payment_id')
    .eq('razorpay_order_id', payment.order_id)
    .maybeSingle()

  if (lookupError) {
    console.error('[Razorpay Webhook] order lookup failed:', lookupError)
    return Response.json({ error: 'Could not find the order' }, { status: 500 })
  }
  if (!order) {
    console.warn('[Razorpay Webhook] captured payment has no matching order')
    return Response.json({ received: true, ignored: true })
  }

  const expectedAmount = Math.round(Number(order.total_price) * 100)
  if (payment.amount !== expectedAmount || payment.currency !== 'INR') {
    console.error('[Razorpay Webhook] captured payment amount/currency mismatch', {
      orderId: order.id,
      paymentId: payment.id,
    })
    return Response.json({ error: 'Payment details do not match the order' }, { status: 400 })
  }

  if (order.status !== 'pending_payment') {
    if (order.razorpay_payment_id === payment.id && order.status !== 'cancelled') {
      return Response.json({ received: true, alreadyProcessed: true })
    }
    console.warn('[Razorpay Webhook] payment received for an order not awaiting payment', {
      orderId: order.id,
      status: order.status,
    })
    return Response.json({ received: true, ignored: true })
  }

  const { data: updatedOrder, error: updateError } = await adminClient
    .from('orders')
    .update({
      status: 'artwork_pending',
      razorpay_payment_id: payment.id,
    })
    .eq('id', order.id)
    .eq('status', 'pending_payment')
    .select('id')
    .maybeSingle()

  if (updateError) {
    console.error('[Razorpay Webhook] failed to mark order paid:', updateError)
    return Response.json({ error: 'Could not update the order' }, { status: 500 })
  }
  if (!updatedOrder) {
    const { data: currentOrder, error: currentOrderError } = await adminClient
      .from('orders')
      .select('status,razorpay_payment_id')
      .eq('id', order.id)
      .maybeSingle()

    if (currentOrderError) {
      console.error('[Razorpay Webhook] failed to confirm order update:', currentOrderError)
      return Response.json({ error: 'Could not confirm the order update' }, { status: 500 })
    }
    if (
      currentOrder?.razorpay_payment_id !== payment.id ||
      currentOrder.status === 'pending_payment' ||
      currentOrder.status === 'cancelled'
    ) {
      console.error('[Razorpay Webhook] order changed while captured payment was processed', {
        orderId: order.id,
        status: currentOrder?.status,
      })
      return Response.json(
        { error: 'Order changed while payment was being processed' },
        { status: 409 }
      )
    }
  }

  return Response.json({ received: true })
}
