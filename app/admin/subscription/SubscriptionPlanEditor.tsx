'use client'

import { useState } from 'react'
import type { SubscriptionBillingPeriod, SubscriptionPlanSettings } from '@/types'

interface Props {
  initialPlan: SubscriptionPlanSettings | null
}

export default function SubscriptionPlanEditor({ initialPlan }: Props) {
  const [amount, setAmount] = useState(
    initialPlan ? (initialPlan.amount_paise / 100).toFixed(2) : '1000'
  )
  const [billingPeriod, setBillingPeriod] = useState<SubscriptionBillingPeriod>(
    initialPlan?.billing_period ?? 'monthly'
  )
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const savePlan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/admin/subscription-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), billingPeriod }),
      })
      const result = (await response.json()) as {
        plan?: SubscriptionPlanSettings
        error?: string
      }

      if (!response.ok || !result.plan) {
        throw new Error(result.error || 'Could not save subscription settings.')
      }

      setAmount((result.plan.amount_paise / 100).toFixed(2))
      setBillingPeriod(result.plan.billing_period)
      setSuccessMessage('The new plan is ready for future subscribers.')
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save subscription settings.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {errorMessage && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {successMessage}
        </p>
      )}

      <form
        onSubmit={savePlan}
        className="space-y-5 rounded-2xl border border-neutral-700 bg-neutral-800/40 p-6"
      >
        <div>
          <label htmlFor="subscription-price" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-300">
            Subscription price (INR)
          </label>
          <input
            id="subscription-price"
            type="number"
            min="1"
            max="1000000"
            step="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full rounded-xl border border-neutral-600 bg-neutral-900 px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="subscription-period" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-300">
            Billing period
          </label>
          <select
            id="subscription-period"
            value={billingPeriod}
            onChange={(event) => setBillingPeriod(event.target.value as SubscriptionBillingPeriod)}
            className="w-full rounded-xl border border-neutral-600 bg-neutral-900 px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-4 text-xs leading-relaxed text-neutral-300">
          Subscribers can place unlimited orders while their subscription is active. Each print
          order is still charged separately. Changes create a new Razorpay plan and apply only to
          new subscribers; existing subscribers keep their current billing terms.
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving plan…' : initialPlan ? 'Save new plan' : 'Create subscription plan'}
        </button>
      </form>

      {initialPlan && (
        <p className="text-xs text-neutral-400">
          Current plan: ₹{(initialPlan.amount_paise / 100).toFixed(2)} /{' '}
          {initialPlan.billing_period === 'monthly' ? 'month' : 'year'}.
        </p>
      )}
    </div>
  )
}
