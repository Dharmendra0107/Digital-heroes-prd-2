import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { DIVISIONS } from '@/lib/products'
import type { Order } from '@/types'
import { formatINR } from '@/lib/currency'
import { readDemoStore } from '@/lib/demo-store'

export default async function AdminReportsPage() {
  let orders: Array<Order & { product?: { division?: string; name?: string } }> = []
  if (isDemoAuthEnabled()) {
    try {
      orders = readDemoStore().orders
    } catch (err) {
      console.error('[AdminReportsPage] local demo data read failed:', err)
    }
  } else {
    const adminClient = createSupabaseAdminClient()
    try {
      const { data } = await adminClient
        .from('orders')
        .select('*, product:products(*)')
        .order('created_at', { ascending: false })
      if (data) orders = data as Array<Order & { product?: { division?: string; name?: string } }>
    } catch (err) {
      console.warn('[AdminReportsPage] error:', err)
    }
  }

  // Calculate status counts
  const statusCounts: Record<string, number> = {}
  orders.forEach((o) => {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1
  })

  // Calculate revenue by division
  const divisionRevenue: Record<string, { count: number; total: number }> = {}
  DIVISIONS.forEach((d) => {
    divisionRevenue[d.slug] = { count: 0, total: 0 }
  })

  orders.forEach((o) => {
    const div = o.product?.division || 'labels-stickers'
    if (!divisionRevenue[div]) {
      divisionRevenue[div] = { count: 0, total: 0 }
    }
    divisionRevenue[div].count += 1
    divisionRevenue[div].total += Number(o.total_price) || 0
  })

  const totalRevenue = orders.reduce((acc, o) => acc + (Number(o.total_price) || 0), 0)

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Order totals by product group.
          </p>
        </div>

        {!isDemoAuthEnabled() && (
          <a
            href="/api/export"
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-2"
          >
            <span>📊</span>
            <span>Download orders CSV</span>
          </a>
        )}
      </div>

      {/* Sales by product group */}
      <div className="bg-neutral-800/40 rounded-2xl border border-neutral-700/60 p-6">
        <h2 className="text-base font-bold text-white mb-4">Sales by product group</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-700 text-neutral-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="pb-3">Division</th>
                <th className="pb-3">Orders</th>
                <th className="pb-3">Order total (GST included)</th>
                <th className="pb-3">% of total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {DIVISIONS.map((div) => {
                const stats = divisionRevenue[div.slug] || { count: 0, total: 0 }
                const pct = totalRevenue > 0 ? (stats.total / totalRevenue) * 100 : 0
                return (
                  <tr key={div.slug} className="hover:bg-neutral-800/50">
                    <td className="py-3 font-semibold text-white">{div.name}</td>
                    <td className="py-3 text-neutral-300">{stats.count} orders</td>
                    <td className="py-3 font-mono font-medium text-amber-400">
                      {formatINR(stats.total)}
                    </td>
                    <td className="py-3 text-neutral-400 font-mono">
                      {pct.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order status */}
      <div className="bg-neutral-800/40 rounded-2xl border border-neutral-700/60 p-6">
        <h2 className="text-base font-bold text-white mb-4">Orders by status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="p-4 bg-neutral-900 rounded-xl border border-neutral-700">
              <span className="text-[10px] uppercase font-mono text-neutral-400 block">
                {status.replace('_', ' ')}
              </span>
              <span className="text-2xl font-bold font-mono text-white mt-1 block">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
