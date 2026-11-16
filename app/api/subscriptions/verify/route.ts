import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import {
  isRazorpayConfigured,
  razorpayRequest,
  verifyRazorpaySubscriptionSignature,
  type RazorpaySubscription,
} from '@/lib/razorpay'
import { normalizeSubscriptionStatus, razorpayTimestampToIso } from '@/lib/subscriptions'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

interface VerifySubscriptionBody {
  razorpay_payment_id?: unknown
  razorpay_subscription_id?: unknown
  razorpay_signature?: unknown
}

export async function POST(request: Request) {
  if (isDemoAuthEnabled()) {
    return Response.json(
      { error: 'Razorpay subscriptions are unavailable in demo mode.' },
      { status: 501 }
    )
  }
  if (!isRazorpayConfigured()) {
    return Response.json({ error: 'Razorpay is not configured.' }, { status: 503 })
  }

  const session = await getAppSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'customer') {
    return Response.json({ error: 'Only customers can subscribe.' }, { status: 403 })
  }

  let body: VerifySubscriptionBody
  try {
    body = (await request.json()) as VerifySubscriptionBody
  } catch {
    return Response.json({ error: 'Invalid subscription response.' }, { status: 400 })
  }

  const { razorpay_payment_id: paymentId, razorpay_subscription_id: subscriptionId, razorpay_signature: signature } = body
  if (
    typeof paymentId !== 'string' ||
    typeof subscriptionId !== 'string' ||
    typeof signature !== 'string'
  ) {
    return Response.json({ error: 'Subscription response is incomplete.' }, { status: 400 })
  }

  if (!verifyRazorpaySubscriptionSignature(subscriptionId, paymentId, signature)) {
    return Response.json({ error: 'Subscription signature verification failed.' }, { status: 400 })
  }

  const adminClient = createSupabaseAdminClient()
  const { data: savedSubscription, error: lookupError } = await adminClient
    .from('customer_subscriptions')
    .select('id,customer_id,razorpay_plan_id,status')
    .eq('razorpay_subscription_id', subscriptionId)
    .maybeSingle()

  if (lookupError) {
    console.error('[subscription verification] subscription lookup failed:', lookupError)
    return Response.json({ error: 'Could not verify the subscription.' }, { status: 500 })
  }
  if (!savedSubscription) {
    return Response.json({ error: 'Subscription not found.' }, { status: 404 })
  }
  if (savedSubscription.customer_id !== session.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let razorpaySubscription: RazorpaySubscription
  try {
    razorpaySubscription = await razorpayRequest<RazorpaySubscription>(
      `/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { method: 'GET' }
    )
  } catch (error) {
    console.error('[subscription verification] Razorpay lookup failed:', error)
    return Response.json({ error: 'Could not confirm subscription status with Razorpay.' }, { status: 502 })
  }

  const status = normalizeSubscriptionStatus(razorpaySubscription.status)
  if (
    razorpaySubscription.id !== subscriptionId ||
    razorpaySubscription.plan_id !== savedSubscription.razorpay_plan_id ||
    !status
  ) {
    console.error('[subscription verification] Razorpay returned mismatched subscription details')
    return Response.json({ error: 'Subscription details do not match.' }, { status: 400 })
  }

  const { error: updateError } = await adminClient
    .from('customer_subscriptions')
    .update({
      status,
      current_start: razorpayTimestampToIso(razorpaySubscription.current_start),
      current_end: razorpayTimestampToIso(razorpaySubscription.current_end),
      charge_at: razorpayTimestampToIso(razorpaySubscription.charge_at),
      updated_at: new Date().toISOString(),
    })
    .eq('id', savedSubscription.id)
    .eq('customer_id', session.userId)

  if (updateError) {
    console.error('[subscription verification] failed to save status:', updateError)
    return Response.json({ error: 'Could not save subscription status.' }, { status: 500 })
  }

  return Response.json({
    success: true,
    active: status === 'active',
    status,
  })
}
