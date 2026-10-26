import { type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json(
      { error: 'Stripe webhook secrets not configured' },
      { status: 500 }
    )
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return Response.json({ error: 'Missing stripe signature' }, { status: 400 })
  }

  const body = await request.text()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err: unknown) {
    console.error('[Stripe Webhook] signature verification failed:', err)
    return Response.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  const adminClient = createSupabaseAdminClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.order_id

    if (orderId) {
      await adminClient
        .from('orders')
        .update({
          status: 'artwork_pending',
          stripe_payment_id: session.payment_intent as string,
        })
        .eq('id', orderId)
    }
  }

  return Response.json({ received: true })
}
