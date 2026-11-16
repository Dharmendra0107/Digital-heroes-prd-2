import { getAppSession } from '@/lib/app-session'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { isRazorpayConfigured, razorpayRequest, type RazorpaySubscription } from '@/lib/razorpay'
import { normalizeSubscriptionStatus } from '@/lib/subscriptions'
import type { SubscriptionPlanSettings } from '@/types'

const CURRENT_SUBSCRIPTION_STATUSES = [
  'created',
  'authenticated',
  'pending',
  'halted',
  'paused',
]
const RAZORPAY_MAX_SUBSCRIPTION_YEARS = 100

export async function POST() {
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
  const customerId = session.userId

  const adminClient = createSupabaseAdminClient()
  const { data: activeSubscription, error: activeError } = await adminClient
    .from('customer_subscriptions')
    .select('id')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .maybeSingle()

  if (activeError) {
    console.error('[subscription checkout] active subscription lookup failed:', activeError)
    return Response.json({ error: 'Could not verify subscription status.' }, { status: 500 })
  }
  if (activeSubscription) {
    return Response.json({ error: 'You already have an active subscription.' }, { status: 409 })
  }

  const { data: planData, error: planError } = await adminClient
    .from('subscription_plan_settings')
    .select('amount_paise,billing_period,razorpay_plan_id,updated_at')
    .eq('id', true)
    .maybeSingle()

  if (planError) {
    console.error('[subscription checkout] plan lookup failed:', planError)
    return Response.json({ error: 'Could not load the subscription plan.' }, { status: 500 })
  }
  if (!planData) {
    return Response.json(
      { error: 'The administrator has not configured a subscription plan yet.' },
      { status: 503 }
    )
  }
  const plan = planData as SubscriptionPlanSettings

  const { data: existingSubscription, error: existingError } = await adminClient
    .from('customer_subscriptions')
    .select('razorpay_subscription_id,razorpay_plan_id,status,amount_paise,billing_period')
    .eq('customer_id', customerId)
    .in('status', CURRENT_SUBSCRIPTION_STATUSES)
    .maybeSingle()

  if (existingError) {
    console.error('[subscription checkout] existing subscription lookup failed:', existingError)
    return Response.json({ error: 'Could not load your subscription status.' }, { status: 500 })
  }
  if (existingSubscription) {
    if (existingSubscription.status === 'created') {
      return Response.json({
        keyId: process.env.RAZORPAY_KEY_ID,
        subscriptionId: existingSubscription.razorpay_subscription_id,
        prefillEmail: session.email,
        billingPeriod: existingSubscription.billing_period,
        amount: existingSubscription.amount_paise,
      })
    }

    return Response.json(
      {
        error:
          'A previous subscription is still being processed or needs attention. Refresh the page or contact support.',
      },
      { status: 409 }
    )
  }

  let razorpaySubscription: RazorpaySubscription
  try {
    razorpaySubscription = await razorpayRequest<RazorpaySubscription>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        plan_id: plan.razorpay_plan_id,
        total_count:
          plan.billing_period === 'monthly'
            ? RAZORPAY_MAX_SUBSCRIPTION_YEARS * 12
            : RAZORPAY_MAX_SUBSCRIPTION_YEARS,
        customer_notify: 1,
        notes: { customer_id: customerId },
      }),
    })
  } catch (error) {
    console.error('[subscription checkout] Razorpay subscription creation failed:', error)
    return Response.json({ error: 'Could not start subscription checkout.' }, { status: 502 })
  }

  const subscriptionStatus = normalizeSubscriptionStatus(razorpaySubscription.status)
  if (
    !razorpaySubscription.id ||
    razorpaySubscription.plan_id !== plan.razorpay_plan_id ||
    !subscriptionStatus
  ) {
    console.error('[subscription checkout] Razorpay returned unexpected subscription details')
    return Response.json({ error: 'Razorpay returned invalid subscription details.' }, { status: 502 })
  }

  const { error: insertError } = await adminClient
    .from('customer_subscriptions')
    .insert({
      customer_id: customerId,
      razorpay_subscription_id: razorpaySubscription.id,
      razorpay_plan_id: plan.razorpay_plan_id,
      amount_paise: plan.amount_paise,
      billing_period: plan.billing_period,
      status: subscriptionStatus,
    })

  if (insertError) {
    console.error('[subscription checkout] failed to save subscription:', insertError)
    return Response.json(
      { error: 'Could not save subscription details. Contact support before retrying.' },
      { status: 500 }
    )
  }

  return Response.json({
    keyId: process.env.RAZORPAY_KEY_ID,
    subscriptionId: razorpaySubscription.id,
    prefillEmail: session.email,
    billingPeriod: plan.billing_period,
    amount: plan.amount_paise,
  })
}
