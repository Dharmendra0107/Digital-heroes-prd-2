import { notFound } from 'next/navigation'
import Link from 'next/link'
import { DIVISIONS } from '@/lib/products'
import { getCatalogProducts } from '@/lib/catalog'
import { formatINR } from '@/lib/currency'
import type { Division } from '@/types'

export async function generateStaticParams() {
  return DIVISIONS.map((d) => ({ division: d.slug }))
}

interface Props {
  params: Promise<{ division: string }>
}

export default async function DivisionPage({ params }: Props) {
  const { division: slug } = await params

  const divisionInfo = DIVISIONS.find((d) => d.slug === slug)
  if (!divisionInfo) notFound()

  const products = await getCatalogProducts(slug as Division)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-neutral-500 mb-8 flex items-center gap-2">
        <Link href="/products" className="hover:text-amber-500 transition-colors">
          Products
        </Link>
        <span>›</span>
        <span className="text-neutral-900 font-medium">{divisionInfo.name}</span>
      </nav>

      {/* Division header */}
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-3">
          {divisionInfo.name}
        </h1>
        <p className="text-amber-500 font-medium text-base mb-2">{divisionInfo.tagline}</p>
        <p className="text-neutral-600 max-w-2xl text-lg">{divisionInfo.description}</p>
      </div>

      {/* Products */}
      <div className="mb-16">
        <h2 className="text-xl font-bold text-neutral-900 mb-6">Available products</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {products.map((product, idx) => (
            <div
              key={product.id}
              className="bg-white rounded-2xl border border-neutral-200 p-6 flex flex-col gap-4 hover:border-amber-300 transition-colors"
            >
              <div>
                <h3 className="text-lg font-bold text-neutral-900">{product.name}</h3>
                <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
                  {product.description}
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide font-medium">
                    Base price
                  </p>
                  <p className="text-2xl font-bold text-neutral-900">
                    {formatINR(product.base_price_per_unit)}
                    <span className="text-sm font-normal text-neutral-400"> / unit</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide font-medium">
                    Sizes
                  </p>
                  <p className="text-sm text-neutral-700">
                    {product.config.sizes.length} options
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wide font-medium">
                    Materials
                  </p>
                  <p className="text-sm text-neutral-700">
                    {product.config.materials.length} options
                  </p>
                </div>
              </div>

              {product.config.has_csv_upload && (
                <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg w-fit">
                  <span>📋</span> Variable data printing supported
                </div>
              )}

              <Link
                href={`/products/${slug}/${idx}`}
                className="inline-flex items-center justify-center gap-2 bg-amber-500 text-white font-semibold px-5 py-3 rounded-xl hover:bg-amber-600 transition-colors text-sm mt-auto w-full sm:w-auto"
              >
                Configure &amp; Order →
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Volume discount table */}
      {products.length > 0 && (
        <div className="mb-12">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">Volume discounts</h2>
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold text-neutral-700">Quantity</th>
                  <th className="text-left px-6 py-3 font-semibold text-neutral-700">Discount</th>
                  <th className="text-left px-6 py-3 font-semibold text-neutral-700 hidden sm:table-cell">
                    Saving
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {products[0].pricing_tiers.map((tier) => (
                  <tr key={tier.min_qty} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-3 text-neutral-800">
                      {tier.min_qty}
                      {tier.max_qty ? ` – ${tier.max_qty}` : '+'} units
                    </td>
                    <td className="px-6 py-3">
                      {tier.discount_percent > 0 ? (
                        <span className="text-green-600 font-semibold">
                          {tier.discount_percent}% off
                        </span>
                      ) : (
                        <span className="text-neutral-400">Standard rate</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-neutral-500 hidden sm:table-cell">
                      {tier.discount_percent > 0
                        ? `Save ${formatINR(
                            products[0].base_price_per_unit *
                              (tier.discount_percent / 100) *
                              tier.min_qty
                          )} on ${tier.min_qty} units`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload artwork mention */}
      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 flex items-start gap-4">
        <div className="text-3xl">🎨</div>
        <div>
          <h3 className="font-bold text-neutral-900 mb-1">Upload your own artwork</h3>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Already have print-ready artwork? Upload your PDF, PNG, SVG or AI file during checkout.
            Our team will review it for print compatibility and send a digital proof before
            production begins.
          </p>
        </div>
      </div>
    </div>
  )
}
