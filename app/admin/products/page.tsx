import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { SAMPLE_PRODUCTS, DIVISIONS } from '@/lib/products'
import type { Product } from '@/types'
import { formatINR } from '@/lib/currency'
import AdminProductEditor from './AdminProductEditor'

export default async function AdminProductsPage() {
  let products: Product[] = []
  if (isDemoAuthEnabled()) {
    products = SAMPLE_PRODUCTS.map((p, i) => ({
      ...p,
      id: `sample-${i}`,
      created_at: new Date().toISOString(),
    }))
  } else {
    const adminClient = createSupabaseAdminClient()
    try {
      const { data } = await adminClient.from('products').select('*').order('name')
      if (data && data.length > 0) {
        products = data as Product[]
      } else {
        products = SAMPLE_PRODUCTS.map((p, i) => ({
          ...p,
          id: `sample-${i}`,
          created_at: new Date().toISOString(),
        }))
      }
    } catch (err) {
      console.warn('[AdminProductsPage] error:', err)
      products = SAMPLE_PRODUCTS.map((p, i) => ({
        ...p,
        id: `sample-${i}`,
        created_at: new Date().toISOString(),
      }))
    }
  }
  const canEditProducts =
    !isDemoAuthEnabled() && products.some((product) => !product.id.startsWith('sample-'))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Products available across six groups.
          </p>
          {isDemoAuthEnabled() && (
            <p className="mt-2 text-xs text-amber-300">
              Demo products are read-only. Connect Supabase to edit saved product records.
            </p>
          )}
        </div>
        {!isDemoAuthEnabled() && (
          <a
            href="/api/seed"
            target="_blank"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl transition-colors"
          >
            🌱 Refresh product list
          </a>
        )}
      </div>

      <div className="bg-neutral-800/40 rounded-2xl border border-neutral-700/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-neutral-900/60 border-b border-neutral-700 text-neutral-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3 px-6">Division</th>
                <th className="py-3 px-6">Product Name</th>
                <th className="py-3 px-6">Base Unit Price</th>
                <th className="py-3 px-6">Sizes Configured</th>
                <th className="py-3 px-6">Materials</th>
                <th className="py-3 px-6">Bleed &amp; DPI</th>
                <th className="py-3 px-6">Status</th>
                {canEditProducts && <th className="py-3 px-6">Edit</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {products.map((p) => {
                const divObj = DIVISIONS.find((d) => d.slug === p.division)
                return (
                  <tr key={p.id} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-amber-400">
                      {divObj?.name || p.division}
                    </td>
                    <td className="py-4 px-6 font-medium text-white">{p.name}</td>
                    <td className="py-4 px-6 font-mono text-white">
                      {formatINR(p.base_price_per_unit)}
                    </td>
                    <td className="py-4 px-6 text-neutral-300">
                      {p.config.sizes?.length || 0} presets
                    </td>
                    <td className="py-4 px-6 text-neutral-300">
                      {p.config.materials?.length || 0} materials
                    </td>
                    <td className="py-4 px-6 font-mono text-neutral-400">
                      {p.config.bleed_mm}mm · {p.config.resolution_dpi} DPI
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {p.active ? 'ACTIVE' : 'HIDDEN'}
                      </span>
                    </td>
                    {canEditProducts && !p.id.startsWith('sample-') && (
                      <td className="py-4 px-6">
                        <AdminProductEditor
                          id={p.id}
                          name={p.name}
                          description={p.description}
                          basePrice={p.base_price_per_unit}
                          active={p.active}
                        />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
