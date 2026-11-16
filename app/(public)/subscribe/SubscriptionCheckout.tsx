'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { CustomerSubscription, SubscriptionPlanSettings } from '@/types'

interface CheckoutCreationResult {
  keyId?: string
  subscriptionId?: string
  prefillEmail?: string
  error?: string
}

interface CheckoutVerificationResult {
  active?: boolean
  status?: string
  error?: string
}

interface Props {
  plan: SubscriptionPlanSettings | null
  subscription: CustomerSubscription | null
  nextPath: string
  customerEmail: string
}

export default function SubscriptionCheckout({
  plan,
  subscription,
  nextPath,
  customerEmail,
}: Props) {
  const router = useRouter()
  const [checkoutReady, setCheckoutReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState('')

  const startCheckout = async () => {
    setBusy(true)
    setErrorMessage('')
    setNotice('')

    try {
      const response = await fetch('/api/subscriptions/checkout', { method: 'POST' })
      const result = (await response.json()) as CheckoutCreationResult
      if (!response.ok) throw new Error(result.error || 'Could not start subscription checkout.')
      if (!result.keyId || !result.subscriptionId) {
        throw new Error('Subscription checkout returned incomplete details.')
      }
      if (!window.Razorpay) {
        throw new Error('Razorpay Checkout is still loading. Please try again in a moment.')
      }

      const checkout = new window.Razorpay({
        key: result.keyId,
        subscription_id: result.subscriptionId,
        name: 'Digital Heroes',
        description: 'Subscription for access to product services',
        prefill: { email: result.prefillEmail || customerEmail },
        theme: { color: '#f59e0b' },
        handler: async (checkoutResponse) => {
          if (
            !checkoutResponse.razorpay_payment_id ||
            !checkoutResponse.razorpay_subscription_id ||
            !checkoutResponse.razorpay_signature
          ) {
            setErrorMessage('Razorpay returned an incomplete subscription response.')
            setBusy(false)
            return
          }

          setBusy(true)
          try {
            const verifyResponse = await fetch('/api/subscriptions/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(checkoutResponse),
            })
            const verification =
              (await verifyResponse.json()) as CheckoutVerificationResult
            if (!verifyResponse.ok) {
              throw new Error(verification.error || 'Could not verify the subscription.')
            }

            if (verification.active) {
              router.push(nextPath)
              router.refresh()
              return
            }

            setNotice(
              `Checkout is complete. Razorpay is still confirming the subscription (${verification.status || 'pending'}); access will unlock when it becomes active.`
            )
            router.refresh()
          } catch (error) {
            setErrorMessage(
              error instanceof Error ? error.message : 'Could not verify the subscription.'
            )
          } finally {
            setBusy(false)
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      })
      checkout.on('payment.failed', (failure) => {
        setErrorMessage(failure.error?.description || 'Subscription payment failed. Please try again.')
        setBusy(false)
      })
      checkout.open()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not start subscription checkout.'
      )
      setBusy(false)
    }
  }

  const cancelSubscription = async () => {
    setBusy(true)
    setErrorMessage('')
    setNotice('')

    try {
      const response = await fetch('/api/subscriptions/cancel', { method: 'POST' })
      const result = (await response.json()) as { error?: string; cancelAtCycleEnd?: boolean }
      if (!response.ok) throw new Error(result.error || 'Could not cancel the subscription.')
      setNotice(
        result.cancelAtCycleEnd
          ? 'Cancellation is scheduled for the end of the current billing period. Your access remains active until then.'
          : 'Your subscription has been cancelled.'
      )
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not cancel the subscription.'
      )
    } finally {
      setBusy(false)
    }
  }

  const isActive = subscription?.status === 'active'

  return (
    <section className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900 p-6 sm:p-8">
      {plan && (!subscription || subscription.status === 'created') && (
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          onReady={() => setCheckoutReady(true)}
          onError={() => setErrorMessage('Could not load Razorpay Checkout. Check your connection and refresh.')}
        />
      )}

      {errorMessage && (
        <p role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {notice}
        </p>
      )}

      {isActive && subscription ? (
        <div>
          <p className="text-sm font-semibold text-emerald-300">Your subscription is active</p>
          <p className="mt-2 text-sm text-neutral-300">
            {subscription.cancel_at_cycle_end
              ? `Access remains active until ${subscription.current_end ? subscription.current_end.slice(0, 10) : 'the end of this billing period'}.`
              : 'You can now browse services and place orders. Print orders are charged separately.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={nextPath}
              className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-black hover:bg-amber-400"
            >
              Continue to services
            </Link>
            {!subscription.cancel_at_cycle_end && (
              <button
                type="button"
                onClick={cancelSubscription}
                disabled={busy}
                className="rounded-xl border border-neutral-600 px-5 py-3 text-sm font-semibold text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
              >
                {busy ? 'Please wait…' : 'Cancel subscription'}
              </button>
            )}
          </div>
        </div>
      ) : subscription?.status === 'created' ? (
        <div>
          <p className="text-sm font-semibold text-amber-300">Checkout has not been completed</p>
          <p className="mt-2 text-sm leading-6 text-neutral-300">
            Continue the {subscription.billing_period} subscription at ₹
            {(subscription.amount_paise / 100).toFixed(2)} to enable service access.
          </p>
          <button
            type="button"
            onClick={startCheckout}
            disabled={busy || !checkoutReady}
            className="mt-5 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Starting checkout…' : checkoutReady ? 'Continue secure checkout' : 'Loading secure checkout…'}
          </button>
        </div>
      ) : subscription ? (
        <div>
          <p className="text-sm font-semibold text-amber-300">Subscription status: {subscription.status}</p>
          <p className="mt-2 text-sm leading-6 text-neutral-300">
            Razorpay is still processing this subscription. You can refresh this page to check
            again; service access is enabled once the status becomes active.
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-5 rounded-xl border border-neutral-600 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Refresh status
          </button>
        </div>
      ) : plan ? (
        <div>
          <p className="text-3xl font-bold">
            ₹{(plan.amount_paise / 100).toFixed(2)}
            <span className="ml-2 text-sm font-medium text-neutral-400">
              / {plan.billing_period === 'monthly' ? 'month' : 'year'}
            </span>
          </p>
          <p className="mt-3 text-sm text-neutral-300">
            Recurring subscription. Cancel anytime; access remains until the current paid period
            ends.
          </p>
          <button
            type="button"
            onClick={startCheckout}
            disabled={busy || !checkoutReady}
            className="mt-6 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Starting checkout…' : checkoutReady ? 'Subscribe with Razorpay' : 'Loading secure checkout…'}
          </button>
        </div>
      ) : (
        <p className="text-sm leading-6 text-neutral-300">
          The administrator has not configured a subscription plan yet. Please check back later or
          contact support.
        </p>
      )}
    </section>
  )
}
