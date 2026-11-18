import SubscriptionPlanPreview from './SubscriptionPlanPreview'

export default function AdminSubscriptionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Subscription plan</h1>
        <p className="mt-1 text-xs text-neutral-400">
          Preview the membership price while Razorpay billing is unavailable.
        </p>
      </div>
      <SubscriptionPlanPreview />
    </div>
  )
}
