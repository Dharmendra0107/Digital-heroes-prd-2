import type { PriceCalculation, PricingTier } from '@/types'

// GST rate for printing services in India (18%)
const TAX_RATE = 0.18

/**
 * Find applicable discount for a given quantity.
 * Tiers are checked from highest qty down.
 */
function getDiscount(qty: number, tiers: PricingTier[]): number {
  const sorted = [...tiers].sort((a, b) => b.min_qty - a.min_qty)
  for (const tier of sorted) {
    if (qty >= tier.min_qty) {
      return tier.discount_percent
    }
  }
  return 0
}

/**
 * Calculate the full price breakdown for an order.
 * base_price_per_unit: price for 1 unit, pre-discount, pre-tax
 * material_multiplier: applied to base price (e.g. 1.2 for premium vinyl)
 */
export function calculatePrice(
  quantity: number,
  base_price_per_unit: number,
  material_multiplier: number,
  tiers: PricingTier[],
  size_multiplier = 1
): PriceCalculation {
  const adjusted_unit = base_price_per_unit * material_multiplier * size_multiplier
  const discount_percent = getDiscount(quantity, tiers)
  const discount_factor = 1 - discount_percent / 100
  const discounted_unit = adjusted_unit * discount_factor

  const subtotal = discounted_unit * quantity
  const discount_amount = adjusted_unit * quantity - subtotal
  const tax_amount = subtotal * TAX_RATE
  const total = subtotal + tax_amount

  return {
    quantity,
    unit_price: parseFloat(discounted_unit.toFixed(2)),
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount_percent,
    discount_amount: parseFloat(discount_amount.toFixed(2)),
    tax_rate: TAX_RATE,
    tax_amount: parseFloat(tax_amount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  }
}
