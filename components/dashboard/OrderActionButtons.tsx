'use client'

import Script from 'next/script'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderStatus } from '@/types'

interface Props {
  orderId: string
  status: OrderStatus
  demo?: boolean
}

export default function OrderActionButtons({ orderId, status, demo = false }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isRazorpayReady, setIsRazorpayReady] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleCheckout = async () => {
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch(`/api/orders/${orderId}/checkout`, {
        method: 'POST',
      })
      const data = (await res.json()) as {
        error?: string
        demo?: boolean
        message?: string
        keyId?: string
        amount?: number
        currency?: string
        razorpayOrderId?: string
        name?: string
        description?: string
        prefillEmail?: string
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate checkout')
      }

      if (data.demo) {
        setSuccessMsg(data.message || 'Demo checkout completed. No payment was collected.')
        setLoading(false)
        router.refresh()
        return
      }

      if (
        !data.keyId ||
        !data.amount ||
        !data.currency ||
        !data.razorpayOrderId ||
        !window.Razorpay
      ) {
        throw new Error('Secure checkout is unavailable. Please refresh and try again.')
      }

      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: data.name || 'Digital Heroes',
        description: data.description || 'Custom Print Order',
        order_id: data.razorpayOrderId,
        prefill: { email: data.prefillEmail || '' },
        theme: { color: '#f59e0b' },
        handler: async (paymentResponse) => {
          if (
            !paymentResponse.razorpay_order_id ||
            !paymentResponse.razorpay_payment_id ||
            !paymentResponse.razorpay_signature
          ) {
            setErrorMsg('Razorpay returned an incomplete payment response.')
            setLoading(false)
            return
          }

          try {
            const verifyResponse = await fetch(`/api/orders/${orderId}/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(paymentResponse),
            })
            const verification = (await verifyResponse.json()) as { error?: string }
            if (!verifyResponse.ok) {
              throw new Error(verification.error || 'Could not verify payment')
            }
            setSuccessMsg('Payment successful. Your order is ready for artwork.')
            setLoading(false)
            router.refresh()
          } catch (err: unknown) {
            setErrorMsg(
              err instanceof Error
                ? `${err.message}. If your account was charged, refresh this order shortly.`
                : 'Could not confirm payment. If your account was charged, refresh this order shortly.'
            )
            setLoading(false)
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      })
      checkout.on('payment.failed', (response) => {
        setErrorMsg(response.error?.description || 'Payment failed. Please try again.')
        setLoading(false)
      })
      checkout.open()
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Payment gateway error. In demo mode, orders can advance directly.'
      )
      setLoading(false)
    }
  }

  const handleReorder = async () => {
    if (!confirm('Would you like to duplicate this order with identical specifications?')) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reorder_from_id: orderId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Could not reorder this job')
      }
      if (typeof data.id !== 'string') {
        throw new Error('The reordered job was not returned by the server')
      }
      router.push(`/orders/${data.id}`)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not reorder this job')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs">
          {successMsg}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {status === 'pending_payment' && (
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading || (!demo && !isRazorpayReady)}
            className="px-6 py-3 bg-neutral-900 hover:bg-black text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-2"
          >
            <span>💳</span>
            <span>
              {loading
                ? 'Processing...'
                : demo
                  ? 'Place order'
                  : isRazorpayReady
                    ? 'Pay online with Razorpay'
                    : 'Loading secure checkout...'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={handleReorder}
          disabled={loading}
          className="px-5 py-3 bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 font-semibold text-xs rounded-xl transition-colors"
        >
          🔄 One-Click Reorder
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl transition-colors"
        >
          🖨️ Print Receipt
        </button>
      </div>
      {demo && status === 'pending_payment' && (
        <p className="text-[11px] text-amber-800">
          Demo checkout: no payment will be taken.
        </p>
      )}
      {!demo && status === 'pending_payment' && (
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
          onReady={() => setIsRazorpayReady(true)}
          onError={() => {
            setIsRazorpayReady(false)
            setErrorMsg('Could not load Razorpay checkout. Check your connection and refresh.')
          }}
        />
      )}
    </div>
  )
}
