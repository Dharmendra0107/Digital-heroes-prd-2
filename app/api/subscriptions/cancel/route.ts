import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { isRazorpayConfigured, razorpayRequest, type RazorpaySubscription } from '@/lib/razorpay'
import { normalizeSubscriptionStatus, razorpayTimestampToIso } from '@/lib/subscriptions'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST() {
  if (isDemoAuthEnabled()) {
    return Response.json({ error: 'Subscription cancellation is unavailable in demo mode.' }, { status: 501 })
  }
  if (!isRazorpayConfigured()) {
    return Response.json({ error: 'Razorpay is not configured.' }, { status: 503 })
  }

  const session = await getAppSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'customer') {
    return Response.json({ error: 'Only customers can cancel their subscription.' }, { status: 403 })
  }

  const adminClient = createSupabaseAdminClient()
  const { data: subscription, error: lookupError } = await adminClient
    .from('customer_subscriptions')
    .select('id,razorpay_subscription_id,razorpay_plan_id,status,cancel_at_cycle_end')
    .eq('customer_id', session.userId)
    .eq('status', 'active')
    .maybeSingle()

  if (lookupError) {
    console.error('[subscription cancellation] lookup failed:', lookupError)
    return Response.json({ error: 'Could not load subscription details.' }, { status: 500 })
  }
  if (!subscription) {
    return Response.json({ error: 'No active subscription was found.' }, { status: 404 })
  }
  if (subscription.cancel_at_cycle_end) {
    return Response.json({ success: true, cancelAtCycleEnd: true })
  }

  let razorpaySubscription: RazorpaySubscription
  try {
    razorpaySubscription = await razorpayRequest<RazorpaySubscription>(
      `/subscriptions/${encodeURIComponent(subscription.razorpay_subscription_id)}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({ cancel_at_cycle_end: 1 }),
      }
    )
  } catch (error) {
    console.error('[subscription cancellation] Razorpay request failed:', error)
    return Response.json({ error: 'Could not schedule subscription cancellation.' }, { status: 502 })
  }

  const status = normalizeSubscriptionStatus(razorpaySubscription.status)
  if (
    razorpaySubscription.id !== subscription.razorpay_subscription_id ||
    razorpaySubscription.plan_id !== subscription.razorpay_plan_id ||
    !status
  ) {
    console.error('[subscription cancellation] Razorpay returned mismatched subscription details')
    return Response.json({ error: 'Razorpay returned invalid subscription details.' }, { status: 502 })
  }

  const cancelled = status === 'cancelled'
  const { error: updateError } = await adminClient
    .from('customer_subscriptions')
    .update({
      status,
      cancel_at_cycle_end: !cancelled,
      current_start: razorpayTimestampToIso(razorpaySubscription.current_start),
      current_end: razorpayTimestampToIso(razorpaySubscription.current_end),
      charge_at: razorpayTimestampToIso(razorpaySubscription.charge_at),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id)
    .eq('customer_id', session.userId)

  if (updateError) {
    console.error('[subscription cancellation] database update failed:', updateError)
    return Response.json({ error: 'Cancellation was requested, but status could not be saved.' }, { status: 500 })
  }

  return Response.json({
    success: true,
    cancelAtCycleEnd: !cancelled,
    status,
  })
}
