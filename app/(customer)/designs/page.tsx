import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { readDemoStore } from '@/lib/demo-store'
import type { Design } from '@/types'

export const metadata = {
  title: 'Saved Designs | Digital Heroes',
}

export default async function SavedDesignsPage() {
  const session = await getAppSession()

  if (!session) return null

  type DesignWithOrder = Design & {
    order?: { config_snapshot?: { size?: { label?: string } } }
  }

  let designs: DesignWithOrder[] = []

  if (!isDemoAuthEnabled()) {
    const supabase = await createSupabaseServerClient()
    try {
      const { data } = await supabase
        .from('designs')
        .select('*, order:orders(*)')
        .eq('customer_id', session.userId)
        .order('updated_at', { ascending: false })

      if (data) {
        designs = data as DesignWithOrder[]
      }
    } catch (err) {
      console.error('[SavedDesignsPage] error:', err)
    }
  } else {
    try {
      const store = readDemoStore()
      designs = store.designs
        .filter((design) => design.customer_id === session.userId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((design) => ({
          ...design,
          order: store.orders.find((order) => order.id === design.order_id),
        }))
    } catch (err) {
      console.error('[SavedDesignsPage] local demo data read failed:', err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Saved Artwork &amp; Designs</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Reorder previous artwork in one click without redesigning or re-uploading files.
          </p>
        </div>
        <Link
          href="/products"
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-xl transition-colors shrink-0"
        >
          + New Artwork
        </Link>
      </div>

      {designs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center shadow-sm">
          <span className="text-4xl block mb-3">🎨</span>
          <h3 className="font-bold text-neutral-800 text-base mb-1">No saved artwork yet</h3>
          <p className="text-xs text-neutral-500 mb-6">
            Designs created in our studio or approved files are automatically archived here.
          </p>
          <Link
            href="/products"
            className="px-5 py-2.5 bg-amber-500 text-white font-semibold text-xs rounded-xl"
          >
            Create Your First Design
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {designs.map((design) => {
            const hasThumbnail =
              design.thumbnail_url && design.thumbnail_url.startsWith('data:image')

            return (
              <div
                key={design.id}
                className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm flex flex-col justify-between"
              >
                <div className="h-44 bg-neutral-100 flex items-center justify-center border-b border-neutral-100 overflow-hidden">
                  {hasThumbnail ? (
                    <img
                      src={design.thumbnail_url}
                      alt="Design Preview"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <span className="text-3xl block mb-1">📐</span>
                      <span className="text-xs font-mono text-neutral-500">
                        {design.upload_type ? `Vector (${design.upload_type.toUpperCase()})` : 'Canvas Design'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">
                      Order #{design.order_id?.slice(0, 8) || 'Archive'}
                    </span>
                    <h3 className="font-semibold text-neutral-900 text-sm mt-2">
                      {design.order?.config_snapshot?.size?.label || 'Custom Print Artwork'}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1">
                      Updated: {new Date(design.updated_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-neutral-100 flex items-center justify-between gap-2 mt-4">
                    <Link
                      href={`/designer/${design.order_id}`}
                      className="text-xs font-semibold text-neutral-600 hover:text-neutral-900"
                    >
                      Open in Studio &rarr;
                    </Link>
                    <Link
                      href={`/orders/${design.order_id}`}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-lg transition-colors"
                    >
                      Reorder Run
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
