import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { readDemoStore } from '@/lib/demo-store'
import DesignerClient from './DesignerClient'
import type { Order } from '@/types'

interface Props {
  params: Promise<{ orderId: string }>
}

export default async function DesignerPage({ params }: Props) {
  const { orderId } = await params

  const session = await getAppSession()

  if (!session) {
    redirect(`/login?next=/designer/${orderId}`)
  }

  // Fetch the order
  let order: Order | null = null
  let designJson: string | undefined = undefined

  if (!isDemoAuthEnabled()) {
    const supabase = await createSupabaseServerClient()
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('*, product:products(*)')
        .eq('id', orderId)
        .single()

      if (orderData) {
        order = orderData as Order
      }

      const { data: designData } = await supabase
        .from('designs')
        .select('canvas_json')
        .eq('order_id', orderId)
        .single()

      if (designData?.canvas_json) {
        designJson = designData.canvas_json
      }
    } catch (err) {
      console.error('[DesignerPage] fetch error:', err)
    }
  } else {
    try {
      const store = readDemoStore()
      const demoOrder = store.orders.find((item) => item.id === orderId)
      if (demoOrder && (session.role === 'admin' || demoOrder.customer_id === session.userId)) {
        order = demoOrder
        designJson = store.designs.find((item) => item.order_id === orderId)?.canvas_json
      }
    } catch (err) {
      console.error('[DesignerPage] local demo data read failed:', err)
    }
  }

  if (isDemoAuthEnabled() && !order) notFound()

  // If order is not in DB yet (e.g. demo mode), build fallback order object
  if (!order) {
    order = {
      id: orderId,
      customer_id: session.userId,
      product_id: 'demo-item',
      status: 'artwork_pending',
      quantity: 100,
      unit_price: 1.2,
      subtotal: 120,
      tax_amount: 21.6,
      total_price: 141.6,
      config_snapshot: {
        size: { label: 'Standard 200×150mm', width_mm: 200, height_mm: 150 },
        material: { label: 'Gloss Vinyl' },
        bleed_mm: 3,
        resolution_dpi: 300,
        print_area: { x: 5, y: 5, width: 190, height: 140 },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  return <DesignerClient order={order} initialDesignJson={designJson} />
}
