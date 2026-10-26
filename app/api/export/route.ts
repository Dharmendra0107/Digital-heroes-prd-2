import { type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import Papa from 'papaparse'
import type { Order } from '@/types'

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Verify Admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return new Response('Forbidden - Admin access required', { status: 403 })
  }

  const adminClient = createSupabaseAdminClient()

  // Fetch orders with profiles and products
  const { data: orders, error } = await adminClient
    .from('orders')
    .select('*, customer:profiles(*), product:products(*)')
    .order('created_at', { ascending: false })

  if (error) {
    return new Response(`Database error: ${error.message}`, { status: 500 })
  }

  // Format into Xero-ready schema
  const xeroRows = (orders || []).map(
    (
      order: Order & {
        customer?: { company?: string; full_name?: string; email?: string }
        product?: { name?: string }
        config_snapshot?: {
          size?: { label?: string }
          material?: { label?: string }
        }
      }
    ) => {
      const customer = order.customer
      const product = order.product
      const cfg = (order.config_snapshot || {}) as {
        size?: { label?: string }
        material?: { label?: string }
      }
      const dateStr = new Date(order.created_at).toISOString().split('T')[0]

    return {
      '*ContactName': customer?.company || customer?.full_name || 'Retail Client',
      'EmailAddress': customer?.email || '',
      '*InvoiceNumber': `INV-${order.id.slice(0, 8).toUpperCase()}`,
      '*InvoiceDate': dateStr,
      '*DueDate': dateStr,
      'Reference': `Order-${order.id.slice(0, 8)}`,
      '*Description': `${product?.name || 'Custom Print'} - ${cfg.size?.label || 'Custom'} (${order.quantity} units)`,
      '*Quantity': order.quantity,
      '*UnitAmount': order.unit_price,
      '*AccountCode': '200', // Sales Revenue
      '*TaxType': 'GST on Income',
      'TaxAmount': order.tax_amount,
      'LineAmount': order.subtotal,
      'Total': order.total_price,
      'Status': order.status,
    }
  })

  const csv = Papa.unparse(xeroRows)

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="Xero_Orders_Export_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
