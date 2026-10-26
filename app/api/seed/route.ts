import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { SAMPLE_PRODUCTS } from '@/lib/products'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'

export async function GET() {
  const session = await getAppSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.role !== 'admin') {
    return Response.json({ error: 'Only admins can load products' }, { status: 403 })
  }
  if (isDemoAuthEnabled()) {
    return Response.json(
      { error: 'Loading products is unavailable in local demo mode' },
      { status: 409 }
    )
  }

  const adminClient = createSupabaseAdminClient()

  try {
    // Check if products already exist
    const { count } = await adminClient
      .from('products')
      .select('*', { count: 'exact', head: true })

    if (count && count > 0) {
      return Response.json({
        message: 'Products already seeded.',
        count,
      })
    }

    // Insert all 6 division sample products
    const { data, error } = await adminClient
      .from('products')
      .insert(SAMPLE_PRODUCTS)
      .select()

    if (error) {
      throw error
    }

    return Response.json({
      success: true,
      message: 'Seeded products successfully across all six divisions.',
      seededCount: data?.length || 0,
      products: data,
    })
  } catch (err: unknown) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : 'Failed to seed database',
        hint: 'Ensure 001_initial_schema.sql has been executed in Supabase SQL editor.',
      },
      { status: 500 }
    )
  }
}
