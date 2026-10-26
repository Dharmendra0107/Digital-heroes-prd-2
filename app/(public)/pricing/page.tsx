import PriceCalculator from '@/components/pricing/PriceCalculator'
import { DIVISIONS } from '@/lib/products'
import Link from 'next/link'
import { formatINR } from '@/lib/currency'
import { getCatalogProducts } from '@/lib/catalog'

export const metadata = {
  title: 'Instant Price Calculator | Digital Heroes',
  description:
    'Live per-unit pricing with automatic volume discounts across all six print divisions.',
}

export default async function PricingPage() {
  const productGroups = await Promise.all(
    DIVISIONS.map((division) => getCatalogProducts(division.slug))
  )
  const products = productGroups.flat()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Page Title */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="text-amber-600 font-semibold text-xs tracking-wider uppercase">
          Clear prices
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 mt-1 mb-4">
          Check your price
        </h1>
        <p className="text-neutral-600 text-base sm:text-lg">
          Choose a size, material and quantity to see an estimate with 18% GST included.
        </p>
      </div>

      {/* Main Interactive Calculator */}
      <div className="mb-16">
        <PriceCalculator products={products} />
      </div>

      {/* Division Base Rates Overview Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8 mb-16 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900 mb-6">
          Standard Starting Rates by Division
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 uppercase text-[11px] font-semibold tracking-wider">
                <th className="pb-3">Division</th>
                <th className="pb-3">Product</th>
                <th className="pb-3">Starting Unit Price</th>
                <th className="pb-3">Default Bleed / DPI</th>
                <th className="pb-3">Max Volume Discount</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.map((prod) => {
                const divObj = DIVISIONS.find((d) => d.slug === prod.division)
                const maxDiscount = Math.max(
                  ...prod.pricing_tiers.map((t) => t.discount_percent)
                )
                return (
                  <tr key={prod.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="py-4 font-semibold text-neutral-900">{divObj?.name}</td>
                    <td className="py-4 text-neutral-600">{prod.name}</td>
                    <td className="py-4 font-mono font-medium text-neutral-900">
                      {formatINR(prod.base_price_per_unit)}
                    </td>
                    <td className="py-4 text-xs font-mono text-neutral-500">
                      {prod.config.bleed_mm}mm / {prod.config.resolution_dpi} DPI
                    </td>
                    <td className="py-4 text-emerald-600 font-semibold">
                      Up to {maxDiscount}% OFF
                    </td>
                    <td className="py-4 text-right">
                      <Link
                        href={`/products/${prod.division}`}
                        className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline"
                      >
                        Order &rarr;
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing FAQs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-xl border border-neutral-200">
          <h3 className="font-semibold text-neutral-900 mb-2">Are taxes included?</h3>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Yes. Prices include 18% GST. The tax amount is shown in your order summary.
          </p>
        </div>
        <div className="p-6 bg-white rounded-xl border border-neutral-200">
          <h3 className="font-semibold text-neutral-900 mb-2">How do volume tiers work?</h3>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Discounts apply automatically per order line item. There are no codes to enter—reach
            the volume threshold and the discount is instantly applied.
          </p>
        </div>
        <div className="p-6 bg-white rounded-xl border border-neutral-200">
          <h3 className="font-semibold text-neutral-900 mb-2">Can I reorder at this price?</h3>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Past designs are saved to your customer dashboard. One-click reordering applies the latest
            active volume discount to your repeat run.
          </p>
        </div>
      </div>
    </div>
  )
}
