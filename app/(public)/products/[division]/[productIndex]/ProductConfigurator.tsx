'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calculatePrice } from '@/lib/pricing/calculator'
import { formatINR } from '@/lib/currency'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Product, Division } from '@/types'

interface Props {
  product: Product | (Omit<Product, 'id' | 'created_at'> & { id?: string })
  divisionSlug: string
  productIndex: number
}

export default function ProductConfigurator({
  product,
  divisionSlug,
  productIndex,
}: Props) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [selectedSizeIndex, setSelectedSizeIndex] = useState(0)
  const [selectedMaterialIndex, setSelectedMaterialIndex] = useState(0)
  const [selectedOrientation, setSelectedOrientation] = useState(
    product.config.orientations?.[0]?.value || 'standard'
  )
  const [quantity, setQuantity] = useState(100)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const activeSize = product.config.sizes[selectedSizeIndex] || product.config.sizes[0]
  const activeMaterial =
    product.config.materials[selectedMaterialIndex] || product.config.materials[0]
  const baseSize = product.config.sizes[0]
  const sizeMultiplier =
    activeSize && baseSize
      ? (activeSize.width_mm * activeSize.height_mm) /
        (baseSize.width_mm * baseSize.height_mm)
      : 1

  const pricing = useMemo(() => {
    return calculatePrice(
      Math.max(1, quantity),
      product.base_price_per_unit,
      activeMaterial?.multiplier || 1.0,
      product.pricing_tiers,
      sizeMultiplier
    )
  }, [quantity, product, activeMaterial, sizeMultiplier])

  const handleStartOrder = async () => {
    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const demoAuthResponse = await fetch('/api/demo-auth')
      const demoAuth = demoAuthResponse.ok ? await demoAuthResponse.json() : null
      const hasDemoSession = Boolean(demoAuth?.user)
      let isAuthenticated = hasDemoSession
      if (!isAuthenticated) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        isAuthenticated = Boolean(user)
      }

      if (!isAuthenticated) {
        // Redirect to login with callback
        const nextUrl = encodeURIComponent(
          `/products/${divisionSlug}/${productIndex}?qty=${quantity}&size=${selectedSizeIndex}&mat=${selectedMaterialIndex}`
        )
        router.push(`/login?next=${nextUrl}`)
        return
      }

      // Create order via API
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id || `demo-${divisionSlug}-${productIndex}`,
          division: divisionSlug,
          product_name: product.name,
          quantity,
          size_index: selectedSizeIndex,
          material_index: selectedMaterialIndex,
          orientation: selectedOrientation,
          config_snapshot: {
            size: activeSize,
            material: activeMaterial,
            orientation: selectedOrientation,
            notes,
            bleed_mm: product.config.bleed_mm,
            resolution_dpi: product.config.resolution_dpi,
            print_area: product.config.print_area,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize order')
      }

      // Take user directly to Web-to-Print Designer & upload stage
      router.push(`/designer/${data.order.id}`)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Configuration Options */}
      <div className="lg:col-span-7 space-y-8 bg-white p-6 sm:p-8 rounded-2xl border border-neutral-200">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 mb-1">Configure Specifications</h2>
          <p className="text-sm text-neutral-500">
            Choose a size, material and quantity for your order.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {errorMsg}
          </div>
        )}

        {/* Size Selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
            1. Dimension / Format
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {product.config.sizes.map((s, idx) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setSelectedSizeIndex(idx)}
                className={`p-4 text-left rounded-xl border transition-all ${
                  idx === selectedSizeIndex
                    ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500 text-neutral-900'
                    : 'border-neutral-200 text-neutral-700 hover:border-neutral-300'
                }`}
              >
                <div className="font-semibold text-sm">{s.label}</div>
                <div className="text-xs font-mono text-neutral-500 mt-1">
                  {s.width_mm}mm × {s.height_mm}mm
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Material Selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
            2. Material
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {product.config.materials.map((m, idx) => (
              <button
                key={m.label}
                type="button"
                onClick={() => setSelectedMaterialIndex(idx)}
                className={`p-4 text-left rounded-xl border transition-all ${
                  idx === selectedMaterialIndex
                    ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500 text-neutral-900'
                    : 'border-neutral-200 text-neutral-700 hover:border-neutral-300'
                }`}
              >
                <div className="font-semibold text-sm">{m.label}</div>
                {m.multiplier !== 1 && (
                  <div className="text-xs text-amber-700 font-medium mt-1">
                    {m.multiplier > 1 ? `+${Math.round((m.multiplier - 1) * 100)}%` : `${Math.round((m.multiplier - 1) * 100)}%`}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Orientation if available */}
        {product.config.orientations && product.config.orientations.length > 0 && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
              3. Orientation
            </label>
            <div className="flex gap-3">
              {product.config.orientations.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSelectedOrientation(o.value)}
                  className={`px-5 py-3 rounded-xl border text-sm font-medium transition-all ${
                    selectedOrientation === o.value
                      ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500 text-neutral-900'
                      : 'border-neutral-200 text-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity Stepper */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Quantity
            </label>
            {pricing.discount_percent > 0 && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                {pricing.discount_percent}% Volume Tier Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-neutral-300 rounded-xl overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 25))}
                className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold"
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
                className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold"
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
                      : 'bg-neutral-50 text-neutral-600 border-neutral-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Production Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
            Job Notes / Instructions (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Special die-cut instructions, packaging requirements, etc."
            className="w-full p-3 border border-neutral-200 rounded-xl text-sm focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Real-time Order Summary Card */}
      <div className="lg:col-span-5 flex flex-col justify-between bg-white p-6 sm:p-8 rounded-2xl border border-neutral-200 shadow-sm h-fit">
        <div>
          <div className="pb-4 border-b border-neutral-200 mb-6">
            <span className="text-amber-500 text-xs font-bold uppercase tracking-wider">
              Selected Item
            </span>
            <h3 className="text-xl font-bold text-neutral-900 mt-1">{product.name}</h3>
            <p className="text-xs text-neutral-500 mt-1 font-mono">
              {activeSize?.label} · {activeMaterial?.label}
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>Configured Unit Price</span>
              <span className="font-mono text-neutral-900">{formatINR(pricing.unit_price)}</span>
            </div>

            {pricing.discount_percent > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Tier Savings ({pricing.discount_percent}%)</span>
                <span className="font-mono">-{formatINR(pricing.discount_amount)}</span>
              </div>
            )}

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
                <span className="text-base font-bold text-neutral-900 block">Total Price</span>
                <span className="text-[11px] text-neutral-400">All inclusive</span>
              </div>
              <div className="text-right">
                <span className="text-3xl font-extrabold text-neutral-900 font-mono block">
                  {formatINR(pricing.total)}
                </span>
                <span className="text-xs text-neutral-500 font-mono">
                  ~{formatINR(pricing.total / quantity)} each
                </span>
              </div>
            </div>
          </div>

          {/* Technical Production Specs */}
          <div className="mt-6 p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-xs space-y-1.5 text-neutral-600">
            <div className="font-semibold text-neutral-800 uppercase tracking-wider text-[10px] mb-2">
              Production Specifications
            </div>
            <div className="flex justify-between">
              <span>Resolution:</span>
              <span className="font-mono font-medium">{product.config.resolution_dpi} DPI</span>
            </div>
            <div className="flex justify-between">
              <span>Bleed Allowance:</span>
              <span className="font-mono font-medium">{product.config.bleed_mm} mm</span>
            </div>
            <div className="flex justify-between">
              <span>Proof Versioning:</span>
              <span className="text-emerald-700 font-medium">Included (Approval Gate)</span>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={handleStartOrder}
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors shadow-sm text-center block"
          >
            {isSubmitting ? 'Initializing Order...' : 'Continue to Artwork & Proof →'}
          </button>
          <p className="text-center text-[11px] text-neutral-400">
            You will review and approve a digital proof before any print run.
          </p>
        </div>
      </div>
    </div>
  )
}
