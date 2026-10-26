import Link from 'next/link'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { readDemoStore } from '@/lib/demo-store'
import Badge from '@/components/ui/Badge'
import type { Order } from '@/types'
import { formatINR } from '@/lib/currency'

export default async function AdminDashboardPage() {
  let orders: Array<
    Order & { customer?: { full_name?: string; email?: string } }
  > = []
  let totalRevenue = 0
  let pendingProofsCount = 0

  if (!isDemoAuthEnabled()) {
    const adminClient = createSupabaseAdminClient()
    try {
      const { data: orderData } = await adminClient
        .from('orders')
        .select('*, customer:profiles(*), product:products(*)')
        .order('created_at', { ascending: false })
        .limit(10)

      if (orderData) {
        orders = orderData as Array<Order & { customer?: { full_name?: string; email?: string } }>
        totalRevenue = orders.reduce((acc, o) => acc + (Number(o.total_price) || 0), 0)
        pendingProofsCount = orders.filter((o) => o.status === 'proof_sent').length
      }
    } catch (err) {
      console.warn('[AdminDashboardPage] error:', err)
    }
  } else {
    try {
      orders = readDemoStore().orders
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 10)
      totalRevenue = orders.reduce((acc, order) => acc + (Number(order.total_price) || 0), 0)
      pendingProofsCount = orders.filter((order) => order.status === 'proof_sent').length
    } catch (err) {
      console.error('[AdminDashboardPage] local demo data read failed:', err)
    }
  }

  const activeJobs = orders.filter(
    (o) => o.status !== 'completed' && o.status !== 'cancelled'
  )

  return (
    <div className="space-y-8">
      {/* Welcome / Action Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div>
          <span className="text-xs uppercase font-mono tracking-wider text-amber-500">
            Order summary
          </span>
          <h1 className="text-2xl font-bold text-white mt-1">Admin overview</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isDemoAuthEnabled() && (
            <>
              <a
                href="/api/seed"
                target="_blank"
                className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors"
              >
                🌱 Load products
              </a>
              <a
                href="/api/export"
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl transition-colors shadow-sm"
              >
                📊 Download orders CSV
              </a>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <div className="bg-neutral-800/60 p-5 rounded-2xl border border-neutral-700/60">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Total Orders
          </p>
          <p className="text-3xl font-extrabold text-white mt-2 font-mono">{orders.length}</p>
          <p className="text-xs text-neutral-400 mt-1">Across 6 product groups</p>
        </div>

        <div className="bg-neutral-800/60 p-5 rounded-2xl border border-neutral-700/60">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Total order value
          </p>
          <p className="text-3xl font-extrabold text-amber-400 mt-2 font-mono">
            {formatINR(totalRevenue)}
          </p>
          <p className="text-xs text-neutral-400 mt-1">Includes 18% GST</p>
        </div>

        <div className="bg-neutral-800/60 p-5 rounded-2xl border border-neutral-700/60">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Active orders
          </p>
          <p className="text-3xl font-extrabold text-white mt-2 font-mono">
            {activeJobs.length}
          </p>
          <p className="text-xs text-neutral-400 mt-1">In progress</p>
        </div>

        <div className="bg-neutral-800/60 p-5 rounded-2xl border border-neutral-700/60">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Proofs to review
          </p>
          <p className="text-3xl font-extrabold text-orange-400 mt-2 font-mono">
            {pendingProofsCount}
          </p>
          <p className="text-xs text-neutral-400 mt-1">Waiting for customer review</p>
        </div>
      </div>

      {/* Live Pipeline Orders Table */}
      <div className="bg-neutral-800/40 rounded-2xl border border-neutral-700/60 overflow-hidden">
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Recent orders</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Latest orders and their current status.
            </p>
          </div>
          <Link
            href="/admin/jobs"
            className="text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            View all orders &rarr;
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center text-neutral-400 text-sm">
            <span className="text-3xl block mb-2">📭</span>
            {isDemoAuthEnabled()
              ? 'No orders yet.'
              : (
                  <>
                    No customer orders yet. First,{' '}
                    <a href="/api/seed" className="text-amber-400 underline">
                      load products
                    </a>{' '}
                    before customers can place orders.
                  </>
                )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-neutral-900/60 border-b border-neutral-700 text-neutral-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-3 px-6">Order ID</th>
                  <th className="py-3 px-6">Customer</th>
                  <th className="py-3 px-6">Product</th>
                  <th className="py-3 px-6">Quantity</th>
                  <th className="py-3 px-6">Total</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {orders.map((order) => {
                  return (
                    <tr key={order.id} className="hover:bg-neutral-800/50 transition-colors">
                      <td className="py-4 px-6 font-mono font-medium text-amber-400">
                        #{order.id.slice(0, 8)}
                      </td>
                      <td className="py-4 px-6 text-neutral-300">
                        <div className="font-semibold text-white">
                          {order.customer?.full_name || 'Retail Customer'}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono">
                          {order.customer?.email || '—'}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-neutral-300">
                        <span className="font-medium text-white">{order.product?.name || 'Custom Print'}</span>
                      </td>
                      <td className="py-4 px-6 font-medium text-white">
                        {order.quantity} units
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-white">
                        {formatINR(order.total_price)}
                      </td>
                      <td className="py-4 px-6">
                        <Badge status={order.status} />
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/admin/jobs/${order.id}`}
                          className="px-3.5 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white font-semibold rounded-lg text-xs transition-colors"
                        >
                          View order &rarr;
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
