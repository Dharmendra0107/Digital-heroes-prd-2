'use client'

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
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate checkout')
      }

      if (data.url) {
        window.location.href = data.url
      } else if (data.demo) {
        setSuccessMsg(data.message)
        setLoading(false)
        router.refresh()
      } else {
        setLoading(false)
        router.refresh()
      }
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
            disabled={loading}
            className="px-6 py-3 bg-neutral-900 hover:bg-black text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-2"
          >
            <span>💳</span>
            <span>
              {loading
                ? 'Processing...'
                : demo
                  ? 'Place order'
                  : 'Pay Online via Stripe'}
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
    </div>
  )
}
