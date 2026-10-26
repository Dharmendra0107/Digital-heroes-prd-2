import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { readDemoStore } from '@/lib/demo-store'
import { formatINR } from '@/lib/currency'
import Badge from '@/components/ui/Badge'
import type { Order } from '@/types'

export const metadata = {
  title: 'My Orders & Proofs | Digital Heroes',
}

export default async function CustomerOrdersPage() {
  const session = await getAppSession()

  if (!session) return null

  let orders: Order[] = []

  if (!isDemoAuthEnabled()) {
    const supabase = await createSupabaseServerClient()
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, product:products(*)')
        .eq('customer_id', session.userId)
        .order('created_at', { ascending: false })

      if (data) {
        orders = data as Order[]
      }
    } catch (err) {
      console.error('[OrdersPage] fetch error:', err)
    }
  } else {
    try {
      orders = readDemoStore().orders
        .filter((order) => order.customer_id === session.userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    } catch (err) {
      console.error('[OrdersPage] local demo data read failed:', err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Order History</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Track status, inspect digital proofs, and download receipts for all your print jobs.
          </p>
        </div>
        <Link
          href="/products"
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-xl transition-colors shrink-0"
        >
          + New Order
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
        {orders.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl block mb-3">📁</span>
            <h3 className="font-bold text-neutral-800 text-base mb-1">No orders yet</h3>
            <p className="text-xs text-neutral-500 mb-6">
              You haven&apos;t placed any custom print orders yet.
            </p>
            <Link
              href="/products"
              className="px-5 py-2.5 bg-amber-500 text-white font-semibold text-xs rounded-xl"
            >
              Browse Catalog
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-3.5 px-6">Order ID</th>
                  <th className="py-3.5 px-6">Placed On</th>
                  <th className="py-3.5 px-6">Product Details</th>
                  <th className="py-3.5 px-6">Quantity</th>
                  <th className="py-3.5 px-6">Total (Inc. Tax)</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {orders.map((order) => {
                  const cfg = (order.config_snapshot || {}) as {
                    size?: { label?: string; width_mm?: number; height_mm?: number }
                    material?: { label?: string }
                  }
                  return (
                    <tr key={order.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-4 px-6 font-mono font-medium text-neutral-900">
                        #{order.id.slice(0, 8)}
                      </td>
                      <td className="py-4 px-6 text-neutral-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-neutral-900">
                          {order.product?.name || 'Custom Print'}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono">
                          {cfg.size?.label || 'Custom'} · {cfg.material?.label || 'Standard'}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-medium text-neutral-900">
                        {order.quantity} units
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-neutral-900">
                        {formatINR(order.total_price)}
                      </td>
                      <td className="py-4 px-6">
                        <Badge status={order.status} />
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <Link
                          href={`/orders/${order.id}`}
                          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-lg text-xs"
                        >
                          Details &amp; Proof &rarr;
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
