import { type NextRequest } from 'next/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import {
  isRazorpayConfigured,
  razorpayRequest,
  RazorpayApiError,
  type RazorpayPlan,
} from '@/lib/razorpay'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { SubscriptionBillingPeriod, SubscriptionPlanSettings } from '@/types'

interface UpdatePlanBody {
  amount?: unknown
  billingPeriod?: unknown
}

export async function PUT(request: NextRequest) {
  const session = await getAppSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })
  if (isDemoAuthEnabled()) {
    return Response.json(
      { error: 'Connect Supabase to configure the subscription plan.' },
      { status: 501 }
    )
  }
  if (!isRazorpayConfigured()) {
    return Response.json({ error: 'Razorpay is not configured.' }, { status: 503 })
  }

  let body: UpdatePlanBody
  try {
    body = (await request.json()) as UpdatePlanBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    typeof body.amount !== 'number' ||
    !Number.isFinite(body.amount) ||
    body.amount <= 0 ||
    body.amount > 1_000_000
  ) {
    return Response.json(
      { error: 'Plan price must be greater than ₹0 and at most ₹10,00,000.' },
      { status: 400 }
    )
  }
  if (body.billingPeriod !== 'monthly' && body.billingPeriod !== 'yearly') {
    return Response.json({ error: 'Billing period must be monthly or yearly.' }, { status: 400 })
  }

  const amountPaise = Math.round(body.amount * 100)
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    return Response.json({ error: 'Plan price is invalid.' }, { status: 400 })
  }

  let razorpayPlan: RazorpayPlan
  try {
    razorpayPlan = await razorpayRequest<RazorpayPlan>('/plans', {
      method: 'POST',
      body: JSON.stringify({
        period: body.billingPeriod,
        interval: 1,
        item: {
          name: `Digital Heroes ${body.billingPeriod} subscription`,
          amount: amountPaise,
          currency: 'INR',
          description:
            'Unlimited order placement while active; each print order is charged separately.',
        },
      }),
    })
  } catch (error) {
    console.error('[admin subscription plan] Razorpay plan creation failed:', error)
    if (error instanceof RazorpayApiError && error.status === 401) {
      return Response.json(
        {
          error:
            'Razorpay rejected the API credentials. Use a matching Key ID and Secret from the same Razorpay mode, then update the server environment and redeploy.',
        },
        { status: 502 }
      )
    }
    return Response.json({ error: 'Could not create the Razorpay subscription plan.' }, { status: 502 })
  }

  if (
    !razorpayPlan.id ||
    razorpayPlan.item?.amount !== amountPaise ||
    razorpayPlan.period !== body.billingPeriod
  ) {
    console.error('[admin subscription plan] Razorpay returned unexpected plan details')
    return Response.json({ error: 'Razorpay returned invalid plan details.' }, { status: 502 })
  }

  const adminClient = createSupabaseAdminClient()
  const { data: plan, error } = await adminClient
    .from('subscription_plan_settings')
    .upsert(
      {
        id: true,
        amount_paise: amountPaise,
        billing_period: body.billingPeriod as SubscriptionBillingPeriod,
        razorpay_plan_id: razorpayPlan.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('amount_paise,billing_period,razorpay_plan_id,updated_at')
    .single()

  if (error || !plan) {
    console.error('[admin subscription plan] database update failed:', error)
    return Response.json({ error: 'Razorpay plan was created, but settings could not be saved.' }, { status: 500 })
  }

  return Response.json({ plan: plan as SubscriptionPlanSettings })
}
