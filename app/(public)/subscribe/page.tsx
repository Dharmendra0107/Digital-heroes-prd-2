import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/app-session'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { CustomerSubscription, SubscriptionPlanSettings } from '@/types'
import SubscriptionCheckout from './SubscriptionCheckout'

interface Props {
  searchParams: Promise<{ next?: string | string[] }>
}

function getSafeNextPath(value: string | string[] | undefined) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return '/products'
  }
  return value
}

export default async function SubscribePage({ searchParams }: Props) {
  const params = await searchParams
  const next = getSafeNextPath(params.next)
  const session = await getAppSession()

  if (!session) {
    const subscribePath = `/subscribe?next=${encodeURIComponent(next)}`
    redirect(`/login?next=${encodeURIComponent(subscribePath)}`)
  }
  if (session.role !== 'customer') redirect('/admin/dashboard')

  const adminClient = createSupabaseAdminClient()
  const [planResult, subscriptionResult] = await Promise.all([
    adminClient
      .from('subscription_plan_settings')
      .select('amount_paise,billing_period,razorpay_plan_id,updated_at')
      .eq('id', true)
      .maybeSingle(),
    adminClient
      .from('customer_subscriptions')
      .select(
        'id,customer_id,razorpay_subscription_id,razorpay_plan_id,amount_paise,billing_period,status,current_start,current_end,charge_at,cancel_at_cycle_end,created_at,updated_at'
      )
      .eq('customer_id', session.userId)
      .in('status', ['created', 'authenticated', 'active', 'pending', 'halted', 'paused'])
      .maybeSingle(),
  ])

  if (planResult.error) {
    console.error('[SubscribePage] failed to load subscription plan:', planResult.error)
  }
  if (subscriptionResult.error) {
    console.error('[SubscribePage] failed to load customer subscription:', subscriptionResult.error)
  }

  const plan = (planResult.data as SubscriptionPlanSettings | null) ?? null
  const subscription = (subscriptionResult.data as CustomerSubscription | null) ?? null

  return (
    <main className="min-h-[70vh] bg-neutral-950 px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
          Digital Heroes membership
        </p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Subscribe to place orders</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300">
          An active subscription unlocks our product services and lets you place unlimited orders.
          Each print order is still priced and paid for separately.
        </p>

        {planResult.error || subscriptionResult.error ? (
          <p role="alert" className="mt-8 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            We could not load your subscription details. Please refresh, or contact support if the
            problem continues.
          </p>
        ) : (
          <SubscriptionCheckout
            plan={plan}
            subscription={subscription}
            nextPath={next}
            customerEmail={session.email}
          />
        )}
      </div>
    </main>
  )
}
