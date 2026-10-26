'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DIVISIONS } from '@/lib/products'
import { calculatePrice } from '@/lib/pricing/calculator'
import { formatINR } from '@/lib/currency'
import type { Product } from '@/types'

export default function PriceCalculator({
  initialDivision,
  products,
}: {
  initialDivision?: string
  products: Product[]
}) {
  const router = useRouter()

  // Select initial product
  const defaultProduct = useMemo(() => {
    if (initialDivision) {
      const match = products.find((p) => p.division === initialDivision)
      if (match) return match
    }
    return products[0]
  }, [initialDivision, products])

  const [selectedDivision, setSelectedDivision] = useState<string>(
    defaultProduct?.division || DIVISIONS[0].slug
  )
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(0)
  const [selectedSizeIndex, setSelectedSizeIndex] = useState<number>(0)
  const [selectedMaterialIndex, setSelectedMaterialIndex] = useState<number>(0)
  const [quantity, setQuantity] = useState<number>(100)

  // Products available in current division
  const divisionProducts = useMemo(() => {
    return products.filter((p) => p.division === selectedDivision)
  }, [products, selectedDivision])

  const activeProduct = divisionProducts[selectedProductIndex] || divisionProducts[0]

  const activeSize = activeProduct?.config.sizes[selectedSizeIndex] || activeProduct?.config.sizes[0]
  const activeMaterial =
    activeProduct?.config.materials[selectedMaterialIndex] || activeProduct?.config.materials[0]
  const baseSize = activeProduct?.config.sizes[0]
  const sizeMultiplier =
    activeSize && baseSize
      ? (activeSize.width_mm * activeSize.height_mm) /
        (baseSize.width_mm * baseSize.height_mm)
      : 1

  // Calculate pricing live
  const pricing = useMemo(() => {
    if (!activeProduct || !activeMaterial) {
      return {
        quantity: 1,
        unit_price: 0,
        subtotal: 0,
        discount_percent: 0,
        discount_amount: 0,
        tax_rate: 0.18,
        tax_amount: 0,
        total: 0,
      }
    }
    return calculatePrice(
      Math.max(1, quantity),
      activeProduct.base_price_per_unit,
      activeMaterial.multiplier,
      activeProduct.pricing_tiers,
      sizeMultiplier
    )
  }, [activeProduct, activeMaterial, quantity, sizeMultiplier])

  const handleDivisionChange = (slug: string) => {
    setSelectedDivision(slug)
    setSelectedProductIndex(0)
    setSelectedSizeIndex(0)
    setSelectedMaterialIndex(0)
  }

  const handleOrderRedirect = () => {
    router.push(`/products/${selectedDivision}`)
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8 bg-neutral-900 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">
              Instant Calculator
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
              Live Price & Volume Estimator
            </h2>
          </div>
          <div className="text-sm text-neutral-400 bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-700">
            GST included · 18%
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* Division Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
              1. Select Division
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DIVISIONS.map((div) => {
                const isSelected = div.slug === selectedDivision
                return (
                  <button
                    key={div.slug}
                    type="button"
                    onClick={() => handleDivisionChange(div.slug)}
                    className={`p-3 text-left rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm ring-1 ring-amber-500'
                        : 'border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    {div.name}
                  </button>
                )
              })}
            </div>
            {!activeProduct && (
              <p className="mt-3 text-xs text-neutral-500">
                No products are currently available in this division.
              </p>
            )}
          </div>

          {/* Size Options */}
          {activeProduct?.config.sizes && activeProduct.config.sizes.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                2. Sizing ({activeProduct.config.sizes.length} Options)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {activeProduct.config.sizes.map((size, idx) => {
                  const isSelected = idx === selectedSizeIndex
                  return (
                    <button
                      key={size.label}
                      type="button"
                      onClick={() => setSelectedSizeIndex(idx)}
                      className={`p-3 text-left rounded-xl border text-xs sm:text-sm transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/50 text-neutral-900 ring-1 ring-amber-500 font-medium'
                          : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                      }`}
                    >
                      <span className="block font-medium">{size.label}</span>
                      <span className="text-xs text-neutral-400 font-mono">
                        {size.width_mm} × {size.height_mm} mm
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Material Options */}
          {activeProduct?.config.materials && activeProduct.config.materials.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                3. Material
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activeProduct.config.materials.map((mat, idx) => {
                  const isSelected = idx === selectedMaterialIndex
                  return (
                    <button
                      key={mat.label}
                      type="button"
                      onClick={() => setSelectedMaterialIndex(idx)}
                      className={`p-3 text-left rounded-xl border text-xs sm:text-sm transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/50 text-neutral-900 ring-1 ring-amber-500 font-medium'
                          : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                      }`}
                    >
                      <span>{mat.label}</span>
                      {mat.multiplier !== 1 && (
                        <span className="block text-[11px] text-amber-600 mt-0.5">
                          {mat.multiplier > 1 ? `+${Math.round((mat.multiplier - 1) * 100)}%` : `${Math.round((mat.multiplier - 1) * 100)}%`}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Quantity Stepper */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                4. Order Quantity
              </label>
              <span className="text-xs text-amber-600 font-medium">
                {pricing.discount_percent > 0 ? `${pricing.discount_percent}% tier applied` : 'Standard tier'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-neutral-300 rounded-xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 25))}
                  className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 text-center py-2.5 font-bold text-neutral-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 25)}
                  className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold transition-colors"
                >
                  +
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[50, 100, 250, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuantity(preset)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                      quantity === preset
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Summary Card */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-neutral-50 rounded-xl p-6 border border-neutral-200">
          <div>
            <h3 className="font-semibold text-neutral-900 text-base mb-4 pb-3 border-b border-neutral-200 flex items-center justify-between">
              <span>Order Summary</span>
              <span className="text-xs font-normal text-neutral-500">Current estimate</span>
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Base Unit Price</span>
                <span className="font-mono text-neutral-900">
                  {formatINR(activeProduct.base_price_per_unit * (activeMaterial?.multiplier || 1))}
                </span>
              </div>

              {pricing.discount_percent > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Volume Savings ({pricing.discount_percent}%)</span>
                  <span className="font-mono">-{formatINR(pricing.discount_amount)}</span>
                </div>
              )}

              <div className="flex justify-between text-neutral-600">
                <span>Unit Price (Discounted)</span>
                <span className="font-mono text-neutral-900">{formatINR(pricing.unit_price)}</span>
              </div>

              <div className="flex justify-between text-neutral-600">
                <span>Subtotal ({quantity} units)</span>
                <span className="font-mono text-neutral-900">{formatINR(pricing.subtotal)}</span>
              </div>

              <div className="flex justify-between text-neutral-500 text-xs">
                <span>GST / Tax (18%)</span>
                <span className="font-mono">{formatINR(pricing.tax_amount)}</span>
              </div>

              <div className="pt-4 border-t border-neutral-200 flex justify-between items-baseline">
                <div>
                  <span className="text-base font-bold text-neutral-900 block">Total</span>
                  <span className="text-[11px] text-neutral-500">Tax inclusive</span>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-extrabold text-neutral-900 font-mono block">
                    {formatINR(pricing.total)}
                  </span>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    ~{formatINR(pricing.total / quantity)} per item
                  </span>
                </div>
              </div>
            </div>

            {/* Discount Tiers Table */}
            <div className="mt-6 pt-4 border-t border-neutral-200">
              <span className="text-[11px] font-semibold uppercase text-neutral-500 tracking-wider block mb-2">
                Available Volume Discounts
              </span>
              <div className="grid grid-cols-4 gap-1 text-center text-xs">
                {activeProduct.pricing_tiers.map((tier) => (
                  <div
                    key={tier.min_qty}
                    className={`p-1.5 rounded border ${
                      quantity >= tier.min_qty && (!tier.max_qty || quantity <= tier.max_qty)
                        ? 'bg-amber-100 border-amber-300 font-bold text-amber-900'
                        : 'bg-white border-neutral-200 text-neutral-600'
                    }`}
                  >
                    <div>{tier.max_qty ? `${tier.min_qty}-${tier.max_qty}` : `${tier.min_qty}+`}</div>
                    <div className="text-[10px] text-amber-700">
                      {tier.discount_percent > 0 ? `-${tier.discount_percent}%` : 'Standard'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-2">
            <button
              type="button"
              onClick={handleOrderRedirect}
              className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors shadow-sm text-center block"
            >
              Configure & Design This Item &rarr;
            </button>
            <p className="text-center text-[11px] text-neutral-400">
              Review your proof before payment.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
