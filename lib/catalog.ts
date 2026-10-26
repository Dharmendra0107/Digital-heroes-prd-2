import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { SAMPLE_PRODUCTS } from '@/lib/products'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Division, Product } from '@/types'

function sampleProducts(division: Division): Product[] {
  return SAMPLE_PRODUCTS.flatMap((product, index) =>
    product.division === division
      ? [{ ...product, id: `sample-${index}`, created_at: '' }]
      : []
  )
}

export async function getCatalogProducts(division: Division): Promise<Product[]> {
  if (isDemoAuthEnabled() || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return sampleProducts(division)
  }

  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('division', division)
      .order('name')
    if (error) throw error
    if (data?.length) return (data as Product[]).filter((product) => product.active)
    return sampleProducts(division)
  } catch (error) {
    console.error(`[catalog] failed to load ${division} products:`, error)
    return sampleProducts(division)
  }
}
