import { type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { SAMPLE_PRODUCTS } from '@/lib/products'
import { calculatePrice } from '@/lib/pricing/calculator'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { readDemoStore, updateDemoStore } from '@/lib/demo-store'
import type { Product, OrderStatus } from '@/types'
import { randomUUID } from 'node:crypto'
import { notifyOrderReceived } from '@/lib/email/notifications'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function createDemoOrder(request: NextRequest) {
  const session = await getAppSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'customer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isRecord(body)) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.reorder_from_id === 'string') {
    try {
      const sourceStore = readDemoStore()
      const source = sourceStore.orders.find(
        (order) =>
          order.id === body.reorder_from_id && order.customer_id === session.userId
      )
      if (!source) return Response.json({ error: 'Order not found' }, { status: 404 })

      const sourceDesign = sourceStore.designs.find(
        (design) => design.order_id === source.id && design.is_saved
      )
      if (!sourceDesign) {
        return Response.json(
          { error: 'This order has no saved artwork to reuse' },
          { status: 409 }
        )
      }

      const now = new Date().toISOString()
      const duplicated = updateDemoStore((store) => {
        const currentSource = store.orders.find(
          (order) => order.id === body.reorder_from_id && order.customer_id === session.userId
        )
        const currentDesign = store.designs.find(
          (design) => design.order_id === body.reorder_from_id && design.is_saved
        )
        if (!currentSource || !currentDesign) return null
        const newOrder = {
          ...currentSource,
          id: randomUUID(),
          status: 'pending_payment' as const,
          stripe_payment_id: undefined,
          stripe_session_id: undefined,
          created_at: now,
          updated_at: now,
        }
        const newDesign = {
          ...currentDesign,
          id: randomUUID(),
          order_id: newOrder.id,
          created_at: now,
          updated_at: now,
        }
        store.orders.unshift(newOrder)
        store.designs.unshift(newDesign)
        return { order: newOrder, design: newDesign }
      })
      if (!duplicated) return Response.json({ error: 'Order not found' }, { status: 404 })
      return Response.json(
        { order: duplicated.order, design: duplicated.design, id: duplicated.order.id },
        { status: 201 }
      )
    } catch (error) {
      console.error('[orders POST] failed to reorder local demo order:', error)
      return Response.json({ error: 'Failed to reorder local demo order' }, { status: 500 })
    }
  }

  const { product_id: productId, quantity, size_index: sizeIndex, material_index: materialIndex } = body
  if (
    typeof productId !== 'string' ||
    !Number.isInteger(quantity) ||
    (quantity as number) < 1 ||
    !Number.isInteger(sizeIndex) ||
    !Number.isInteger(materialIndex)
  ) {
    return Response.json({ error: 'Missing or invalid required fields' }, { status: 400 })
  }

  const sampleIndex = /^sample-(\d+)$/.exec(productId)
  const demoProduct = /^demo-([a-z-]+)-(\d+)$/.exec(productId)
  const divisionProducts = demoProduct
    ? SAMPLE_PRODUCTS.filter((product) => product.division === demoProduct[1])
    : []
  const productIndex = sampleIndex
    ? Number(sampleIndex[1])
    : Number(demoProduct?.[2])
  const sample = sampleIndex
    ? SAMPLE_PRODUCTS[productIndex]
    : divisionProducts[productIndex]
  if (!sample) return Response.json({ error: 'Product not found' }, { status: 404 })
  if ((sizeIndex as number) < 0 || (sizeIndex as number) >= sample.config.sizes.length) {
    return Response.json({ error: 'size_index out of range' }, { status: 400 })
  }
  if ((materialIndex as number) < 0 || (materialIndex as number) >= sample.config.materials.length) {
    return Response.json({ error: 'material_index out of range' }, { status: 400 })
  }

  const material = sample.config.materials[materialIndex as number]
  const size = sample.config.sizes[sizeIndex as number]
  const baseSize = sample.config.sizes[0]
  const sizeMultiplier =
    (size.width_mm * size.height_mm) / (baseSize.width_mm * baseSize.height_mm)
  const price = calculatePrice(
    quantity as number,
    sample.base_price_per_unit,
    material.multiplier,
    sample.pricing_tiers,
    sizeMultiplier
  )
  const now = new Date().toISOString()
  const clientConfig = isRecord(body.config_snapshot) ? body.config_snapshot : {}
  const order = {
    id: randomUUID(),
    customer_id: session.userId,
    product_id: `demo-${sample.division}-${productIndex}`,
    product: { ...sample, id: `demo-${sample.division}-${productIndex}`, created_at: now },
    status: 'pending_payment' as const,
    quantity: quantity as number,
    unit_price: price.unit_price,
    subtotal: price.subtotal,
    tax_amount: price.tax_amount,
    total_price: price.total,
    config_snapshot: {
      size,
      material,
      orientation: typeof body.orientation === 'string' ? body.orientation : 'standard',
      notes: typeof clientConfig.notes === 'string' ? clientConfig.notes.slice(0, 2000) : '',
      bleed_mm: sample.config.bleed_mm,
      resolution_dpi: sample.config.resolution_dpi,
      print_area: sample.config.print_area,
    },
    customer: {
      email: session.email,
      full_name: session.name,
      company: session.company,
    },
    created_at: now,
    updated_at: now,
  }

  try {
    updateDemoStore((store) => {
      store.orders.unshift(order)
    })
  } catch (error) {
    console.error('[orders POST] failed to save local demo order:', error)
    return Response.json({ error: 'Failed to save local demo order' }, { status: 500 })
  }

  const notification = await notifyOrderReceived(
    session.email,
    order.id,
    session.name,
    sample.name,
    order.total_price
  )
  return Response.json({ order, id: order.id, notification }, { status: 201 })
}

// ----------------------------------------------------------------
// POST /api/orders — Create a new order
// ----------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (isDemoAuthEnabled()) return createDemoOrder(request)

  const supabase = await createSupabaseServerClient()

  // Require auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    typeof body === 'object' &&
    body !== null &&
    'reorder_from_id' in body &&
    typeof body.reorder_from_id === 'string'
  ) {
    const adminClient = createSupabaseAdminClient()
    const { data: source, error: sourceError } = await adminClient
      .from('orders')
      .select('*')
      .eq('id', body.reorder_from_id)
      .eq('customer_id', user.id)
      .maybeSingle()
    if (sourceError) {
      console.error('[orders POST] reorder source lookup failed:', sourceError)
      return Response.json({ error: 'Could not load the order to reorder' }, { status: 500 })
    }
    if (!source) return Response.json({ error: 'Order not found' }, { status: 404 })

    const { data: sourceDesign, error: designError } = await adminClient
      .from('designs')
      .select('*')
      .eq('order_id', source.id)
      .eq('customer_id', user.id)
      .eq('is_saved', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (designError) {
      console.error('[orders POST] reorder artwork lookup failed:', designError)
      return Response.json({ error: 'Could not load saved artwork' }, { status: 500 })
    }
    if (!sourceDesign) {
      return Response.json(
        { error: 'This order has no saved artwork to reuse' },
        { status: 409 }
      )
    }

    const { data: newOrder, error: orderError } = await adminClient
      .from('orders')
      .insert({
        customer_id: user.id,
        product_id: source.product_id,
        status: 'pending_payment',
        quantity: source.quantity,
        unit_price: source.unit_price,
        subtotal: source.subtotal,
        tax_amount: source.tax_amount,
        total_price: source.total_price,
        config_snapshot: source.config_snapshot,
        notes: source.notes,
      })
      .select()
      .single()
    if (orderError || !newOrder) {
      console.error('[orders POST] reorder creation failed:', orderError)
      return Response.json({ error: 'Could not create the reordered job' }, { status: 500 })
    }

    const { data: newDesign, error: newDesignError } = await adminClient
      .from('designs')
      .insert({
        order_id: newOrder.id,
        customer_id: user.id,
        canvas_json: sourceDesign.canvas_json,
        upload_url: sourceDesign.upload_url,
        upload_type: sourceDesign.upload_type,
        thumbnail_url: sourceDesign.thumbnail_url,
        is_saved: true,
      })
      .select()
      .single()
    if (newDesignError || !newDesign) {
      console.error('[orders POST] reordered artwork copy failed:', newDesignError)
      const { error: cleanupError } = await adminClient
        .from('orders')
        .delete()
        .eq('id', newOrder.id)
        .eq('customer_id', user.id)
      if (cleanupError) {
        console.error('[orders POST] failed to remove incomplete reordered job:', cleanupError)
      }
      return Response.json({ error: 'Could not copy saved artwork to the new job' }, { status: 500 })
    }

    return Response.json(
      { order: newOrder, design: newDesign, id: newOrder.id },
      { status: 201 }
    )
  }

  const { product_id, quantity, size_index, material_index, config_snapshot } = body as {
    product_id?: unknown
    quantity?: unknown
    size_index?: unknown
    material_index?: unknown
    config_snapshot?: unknown
  }

  if (
    typeof product_id !== 'string' ||
    !product_id ||
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    typeof size_index !== 'number' ||
    typeof material_index !== 'number'
  ) {
    return Response.json({ error: 'Missing or invalid required fields' }, { status: 400 })
  }

  // Resolve product — try DB first, then sample data
  let product: Product | null = null
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('active', true)
      .single()
    if (!error && data) product = data as Product
  } catch (err) {
    console.error('[orders POST] product lookup error:', err)
  }

  if (!product) {
    const sample = SAMPLE_PRODUCTS.find((p, i) =>
      `sample-${i}` === product_id ||
      `demo-${p.division}-${i}` === product_id ||
      product_id.includes(p.division)
    )
    if (sample) product = { ...sample, id: product_id, created_at: '' }
  }

  if (!product) {
    return Response.json({ error: 'Product not found' }, { status: 404 })
  }

  if (size_index < 0 || size_index >= product.config.sizes.length) {
    return Response.json({ error: 'size_index out of range' }, { status: 400 })
  }
  if (material_index < 0 || material_index >= product.config.materials.length) {
    return Response.json({ error: 'material_index out of range' }, { status: 400 })
  }

  // Server-side price calculation — never trust client prices
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

  const adminClient = createSupabaseAdminClient()

  const { data: order, error: insertError } = await adminClient
    .from('orders')
    .insert({
      customer_id: user.id,
      product_id,
      status: 'pending_payment',
      quantity,
      unit_price: price.unit_price,
      subtotal: price.subtotal,
      tax_amount: price.tax_amount,
      total_price: price.total,
      config_snapshot: {
        size_index,
        material_index,
        size,
        material: material.label,
        orientation:
          typeof config_snapshot === 'object' &&
          config_snapshot !== null &&
          'orientation' in config_snapshot &&
          typeof config_snapshot.orientation === 'string' &&
          product.config.orientations?.some(
            (option) => option.value === config_snapshot.orientation
          )
            ? config_snapshot.orientation
            : product.config.orientations?.[0]?.value || 'standard',
        notes:
          typeof config_snapshot === 'object' &&
          config_snapshot !== null &&
          'notes' in config_snapshot &&
          typeof config_snapshot.notes === 'string'
            ? config_snapshot.notes.slice(0, 2000)
            : '',
        bleed_mm: product.config.bleed_mm,
        resolution_dpi: product.config.resolution_dpi,
        print_area: product.config.print_area,
      },
    })
    .select()
    .single()

  if (insertError) {
    console.error('[orders POST] insert error:', insertError)
    return Response.json({ error: 'Failed to create order' }, { status: 500 })
  }

  const notification = await notifyOrderReceived(
    user.email ?? '',
    order.id,
    user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer',
    product.name,
    order.total_price
  )
  return Response.json({ order, id: order.id, notification }, { status: 201 })
}

// ----------------------------------------------------------------
// GET /api/orders — List orders for current user
// ----------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (isDemoAuthEnabled()) {
    const session = await getAppSession()
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    try {
      const { searchParams } = request.nextUrl
      const status = searchParams.get('status')
      const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100)
      const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)
      const store = readDemoStore()
      const allOrders = store.orders.filter(
        (order) => session.role === 'admin' || order.customer_id === session.userId
      )
      const filtered = status ? allOrders.filter((order) => order.status === status) : allOrders
      return Response.json({
        orders: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
      })
    } catch (error) {
      console.error('[orders GET] failed to read local demo orders:', error)
      return Response.json({ error: 'Failed to fetch local demo orders' }, { status: 500 })
    }
  }

  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Parse query params
  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') as OrderStatus | null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  let query = supabase
    .from('orders')
    .select('*, product:products(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!isAdmin) {
    query = query.eq('customer_id', user.id)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data: orders, error, count } = await query

  if (error) {
    console.error('[orders GET] query error:', error)
    return Response.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }

  return Response.json({ orders, total: count, limit, offset })
}
