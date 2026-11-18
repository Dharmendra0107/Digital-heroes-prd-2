import { DISPLAY_SUBSCRIPTION_PLAN } from '@/lib/subscription-plan-display'

export default function SubscriptionPlanPreview() {
  return (
    <section className="max-w-2xl space-y-5 rounded-2xl border border-neutral-700 bg-neutral-800/40 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
          Display-only preview
        </p>
        <p className="mt-3 text-3xl font-bold text-white">
          ₹{(DISPLAY_SUBSCRIPTION_PLAN.amountPaise / 100).toFixed(2)}
          <span className="ml-2 text-sm font-medium text-neutral-400">/ year</span>
        </p>
      </div>
      <p className="text-sm leading-6 text-neutral-300">
        An active membership allows unlimited order placement. Each print order is charged
        separately.
      </p>
      <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
        This is a display price only; it does not create a Razorpay plan or unlock customer access.
        Checkout remains unavailable until Razorpay is verified and a real plan is configured.
      </p>
    </section>
  )
}
