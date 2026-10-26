'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import type { OrderStatus } from '@/types'

export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/admin/jobs')
  revalidatePath('/admin/dashboard')
  revalidatePath('/dashboard')

  return { success: true }
}

export async function reorderFromPreviousAction(orderId: string) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data: previousOrder } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (!previousOrder) {
    throw new Error('Order not found')
  }

  const adminClient = createSupabaseAdminClient()
  const { data: newOrder, error } = await adminClient
    .from('orders')
    .insert({
      customer_id: user.id,
      product_id: previousOrder.product_id,
      status: 'pending_payment',
      quantity: previousOrder.quantity,
      unit_price: previousOrder.unit_price,
      subtotal: previousOrder.subtotal,
      tax_amount: previousOrder.tax_amount,
      total_price: previousOrder.total_price,
      config_snapshot: previousOrder.config_snapshot,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  revalidatePath('/orders')

  return { success: true, orderId: newOrder.id }
}
