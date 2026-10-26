import Link from 'next/link'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { readDemoStore } from '@/lib/demo-store'
import { formatINR } from '@/lib/currency'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import Badge from '@/components/ui/Badge'
import type { Order, Proof } from '@/types'

export default async function CustomerDashboardPage() {
  const session = await getAppSession()

  if (!session) return null

  // Fetch recent customer orders
  let orders: Order[] = []
  let pendingProofs: Proof[] = []

  if (!isDemoAuthEnabled()) {
    const supabase = await createSupabaseServerClient()
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('*, product:products(*)')
        .eq('customer_id', session.userId)
        .order('created_at', { ascending: false })
        .limit(5)

      if (orderData) {
        orders = orderData as Order[]
      }

      if (orders.length > 0) {
        const orderIds = orders.map((o) => o.id)
        const { data: proofData } = await supabase
          .from('proofs')
          .select('*')
          .in('order_id', orderIds)
          .eq('status', 'pending')

        if (proofData) {
          pendingProofs = proofData as Proof[]
        }
      }
    } catch (err) {
      console.error('[CustomerDashboard] fetch error:', err)
    }
  } else {
    try {
      const store = readDemoStore()
      orders = store.orders
        .filter((order) => order.customer_id === session.userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5)
      const orderIds = new Set(orders.map((order) => order.id))
      pendingProofs = store.proofs.filter(
        (proof) => orderIds.has(proof.order_id) && proof.status === 'pending'
      )
    } catch (err) {
      console.error('[CustomerDashboard] local demo data read failed:', err)
    }
  }

  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'completed' && o.status !== 'cancelled'
  ).length

  return (
    <div className="space-y-8">
      {/* Pending Proofs Alert Notice */}
      {pendingProofs.length > 0 && (
        <div className="bg-amber-500 text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <h3 className="font-bold text-base">
                Proof Approval Required ({pendingProofs.length} Pending)
              </h3>
            </div>
            <p className="text-xs text-amber-100 mt-1">
              Your print job is on hold until you review and sign off on your digital artwork proof.
            </p>
          </div>
          <Link
            href={`/orders/${pendingProofs[0].order_id}`}
            className="px-4 py-2.5 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition-colors shrink-0 text-center"
          >
            Review Proof Now &rarr;
          </Link>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Total Orders
          </p>
          <p className="text-3xl font-extrabold text-neutral-900 mt-2 font-mono">
            {orders.length}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Orders placed to date</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Orders in progress
          </p>
          <p className="text-3xl font-extrabold text-amber-500 mt-2 font-mono">
            {activeOrdersCount}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Being prepared, reviewed or printed</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Proofs to review
          </p>
          <p className="text-3xl font-extrabold text-neutral-900 mt-2 font-mono">
            {pendingProofs.length}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Digital proofs pending</p>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Recent Orders</h2>
            <p className="text-xs text-neutral-500">
              Check order status and review proofs.
            </p>
          </div>
          <Link
            href="/orders"
            className="text-xs font-semibold text-amber-600 hover:text-amber-700"
          >
            View all &rarr;
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl block mb-3">📦</span>
            <h3 className="font-bold text-neutral-800 text-base mb-1">No orders placed yet</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-6">
              Select one of our six print divisions to configure your specifications and receive an
              instant quote.
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-xl transition-colors"
            >
              Start New Order &rarr;
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-neutral-50/50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-3 px-6">Order ID</th>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Product &amp; Specs</th>
                  <th className="py-3 px-6">Quantity</th>
                  <th className="py-3 px-6">Total</th>
                  <th className="py-3 px-6">Stage</th>
                  <th className="py-3 px-6 text-right">Action</th>
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
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/orders/${order.id}`}
                          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-lg text-xs transition-colors"
                        >
                          View &rarr;
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
