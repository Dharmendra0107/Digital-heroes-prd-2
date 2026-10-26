import Link from 'next/link'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { readDemoStore } from '@/lib/demo-store'
import Badge from '@/components/ui/Badge'
import { formatINR } from '@/lib/currency'
import type { Order } from '@/types'

interface Props {
  searchParams: Promise<{
    status?: string
    search?: string
  }>
}

const STAGES = [
  { key: 'all', label: 'All Jobs' },
  { key: 'pending_payment', label: 'Pending Payment' },
  { key: 'artwork_pending', label: 'Artwork Pending' },
  { key: 'proof_sent', label: 'Proof Sent' },
  { key: 'proof_approved', label: 'Proof Approved' },
  { key: 'in_production', label: 'In Production' },
  { key: 'completed', label: 'Completed' },
]

export default async function AdminJobsPage({ searchParams }: Props) {
  const { status, search } = await searchParams

  let orders: Array<
    Order & { customer?: { email?: string; full_name?: string } }
  > = []

  if (!isDemoAuthEnabled()) {
    const adminClient = createSupabaseAdminClient()
    try {
      let query = adminClient
        .from('orders')
        .select('*, customer:profiles(*), product:products(*)')
        .order('created_at', { ascending: false })

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      const { data } = await query
      if (data) {
        orders = data as Array<Order & { customer?: { email?: string; full_name?: string } }>
        if (search) {
          const s = search.toLowerCase()
          orders = orders.filter(
            (o) =>
              o.id.toLowerCase().includes(s) ||
              o.customer?.email?.toLowerCase().includes(s) ||
              o.customer?.full_name?.toLowerCase().includes(s) ||
              o.product?.name?.toLowerCase().includes(s)
          )
        }
      }
    } catch (err) {
      console.warn('[AdminJobsPage] error:', err)
    }
  } else {
    try {
      orders = readDemoStore().orders
        .filter((order) => !status || status === 'all' || order.status === status)
        .filter((order) => {
          if (!search) return true
          const needle = search.toLowerCase()
          return (
          order.id.toLowerCase().includes(needle) ||
          order.customer?.email?.toLowerCase().includes(needle) ||
          order.customer?.full_name?.toLowerCase().includes(needle) ||
          order.product?.name?.toLowerCase().includes(needle)
          )
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    } catch (err) {
      console.error('[AdminJobsPage] local demo data read failed:', err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Order &rarr; Artwork &rarr; Proof &rarr; Printing &rarr; Done
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-neutral-800/60 p-4 rounded-xl border border-neutral-700/60">
        {/* Stage Filter Buttons */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {STAGES.map((s) => {
            const isSelected = (!status && s.key === 'all') || status === s.key
            return (
              <Link
                key={s.key}
                href={s.key === 'all' ? '/admin/jobs' : `/admin/jobs?status=${s.key}`}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  isSelected
                    ? 'bg-amber-500 text-black font-bold shadow-sm'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {s.label}
              </Link>
            )
          })}
        </div>

        {/* Search input form */}
        <form method="GET" className="w-full sm:w-64">
          <input
            type="text"
            name="search"
            defaultValue={search || ''}
            placeholder="Search ID, email..."
            className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
          />
        </form>
      </div>

      {/* Jobs Table */}
      <div className="bg-neutral-800/40 rounded-2xl border border-neutral-700/60 overflow-hidden shadow-sm">
        {orders.length === 0 ? (
          <div className="p-12 text-center text-neutral-400 text-xs">
            No orders match the current filter or search criteria.
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
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {orders.map((order) => {
                  return (
                    <tr key={order.id} className="hover:bg-neutral-800/50 transition-colors">
                      <td className="py-4 px-6 font-mono font-medium text-amber-400">
                        #{order.id.slice(0, 8)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-white">
                          {order.customer?.full_name || 'Retail Client'}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono">
                          {order.customer?.email || 'N/A'}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-neutral-300">
                        {order.product?.name || 'Custom Print'}
                      </td>
                      <td className="py-4 px-6 font-medium text-white">{order.quantity}</td>
                      <td className="py-4 px-6 font-mono font-bold text-white">
                        {formatINR(order.total_price)}
                      </td>
                      <td className="py-4 px-6">
                        <Badge status={order.status} />
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/admin/jobs/${order.id}`}
                          className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white font-medium rounded-lg text-xs"
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
