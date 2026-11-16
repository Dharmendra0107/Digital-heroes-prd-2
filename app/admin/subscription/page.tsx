import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { SubscriptionPlanSettings } from '@/types'
import SubscriptionPlanEditor from './SubscriptionPlanEditor'

export default async function AdminSubscriptionPage() {
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('subscription_plan_settings')
    .select('amount_paise,billing_period,razorpay_plan_id,updated_at')
    .eq('id', true)
    .maybeSingle()

  if (error) {
    console.error('[AdminSubscriptionPage] failed to load plan settings:', error)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Subscription plan</h1>
        <p className="mt-1 text-xs text-neutral-400">
          Configure the recurring access plan required before customers can browse services.
        </p>
      </div>
      {error ? (
        <p role="alert" className="max-w-2xl rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          Could not load subscription settings. Apply migration 004 and check the Supabase
          configuration before retrying.
        </p>
      ) : (
        <SubscriptionPlanEditor initialPlan={(data as SubscriptionPlanSettings | null) ?? null} />
      )}
    </div>
  )
}
