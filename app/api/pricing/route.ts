import { type NextRequest } from 'next/server'
import { SAMPLE_PRODUCTS } from '@/lib/products'
import { calculatePrice } from '@/lib/pricing/calculator'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Product } from '@/types'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { product_id, quantity, size_index, material_index } = body as {
    product_id?: unknown
    quantity?: unknown
    size_index?: unknown
    material_index?: unknown
  }

  // Validate inputs
  if (
    typeof product_id !== 'string' ||
    !product_id ||
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    typeof size_index !== 'number' ||
    !Number.isInteger(size_index) ||
    size_index < 0 ||
    typeof material_index !== 'number' ||
    !Number.isInteger(material_index) ||
    material_index < 0
  ) {
    return Response.json(
      {
        error:
          'Invalid input. Required: product_id (string), quantity (positive integer), size_index (integer >= 0), material_index (integer >= 0)',
      },
      { status: 400 }
    )
  }

  let product: Product | null = null

  // Try Supabase first if configured
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    try {
      const supabase = await createSupabaseServerClient()
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', product_id)
        .eq('active', true)
        .single()

      if (!error && data) {
        product = data as Product
      }
    } catch (err) {
      console.error('[pricing] Supabase lookup failed, falling back to SAMPLE_PRODUCTS:', err)
    }
  }

  // Fall back to SAMPLE_PRODUCTS (match by index position when no DB yet)
  if (!product) {
    const sample = SAMPLE_PRODUCTS.find((_, i) => `sample-${i}` === product_id)
    if (sample) {
      product = { ...sample, id: product_id, created_at: '' }
    }
  }

  if (!product) {
    return Response.json({ error: 'Product not found' }, { status: 404 })
  }

  // Validate indexes against product config
  if (size_index >= product.config.sizes.length) {
    return Response.json(
      { error: `size_index out of range. Product has ${product.config.sizes.length} sizes.` },
      { status: 400 }
    )
  }
  if (material_index >= product.config.materials.length) {
    return Response.json(
      {
        error: `material_index out of range. Product has ${product.config.materials.length} materials.`,
      },
      { status: 400 }
    )
  }

  const material = product.config.materials[material_index]
  const size = product.config.sizes[size_index]
  const baseSize = product.config.sizes[0]
  const sizeMultiplier =
    (size.width_mm * size.height_mm) / (baseSize.width_mm * baseSize.height_mm)
  const price = calculatePrice(
    quantity,
    product.base_price_per_unit,
    material.multiplier,
    product.pricing_tiers,
    sizeMultiplier
  )

  return Response.json({
    ...price,
    product_id,
    size,
    material: material.label,
  })
}
