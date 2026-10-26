import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { readDemoStore } from '@/lib/demo-store'
import Badge from '@/components/ui/Badge'
import AdminJobActions from '@/components/dashboard/AdminJobActions'
import type { Order, Proof, PrintFile, Design, Product, Profile } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminJobDetailPage({ params }: Props) {
  const { id } = await params

  type OrderDetail = Omit<Order, 'customer' | 'product'> & {
    customer?: Partial<Profile>
    product?: Partial<Product>
  }

  let order: OrderDetail | null = null
  let proofs: Proof[] = []
  let design: Design | null = null
  let printFile: PrintFile | null = null

  if (!isDemoAuthEnabled()) {
    const adminClient = createSupabaseAdminClient()
    try {
      const { data: orderData } = await adminClient
        .from('orders')
        .select('*, customer:profiles(*), product:products(*)')
        .eq('id', id)
        .single()

      if (orderData) {
        order = orderData as OrderDetail
      }

      const { data: proofData } = await adminClient
        .from('proofs')
        .select('*')
        .eq('order_id', id)
        .order('version', { ascending: false })

      if (proofData) {
        proofs = proofData as Proof[]
      }

      const { data: designData } = await adminClient
        .from('designs')
        .select('*')
        .eq('order_id', id)
        .single()

      if (designData) {
        design = designData as Design
      }

      const { data: fileData } = await adminClient
        .from('print_files')
        .select('*')
        .eq('order_id', id)
        .single()

      if (fileData) {
        printFile = fileData as PrintFile
      }
    } catch (err) {
      console.warn('[AdminJobDetailPage] error:', err)
    }
  } else {
    try {
      const store = readDemoStore()
      order = store.orders.find((item) => item.id === id) ?? null
      proofs = store.proofs
        .filter((proof) => proof.order_id === id)
        .sort((a, b) => b.version - a.version)
      design = store.designs.find((item) => item.order_id === id) ?? null
      printFile = store.printFiles.find((file) => file.order_id === id) ?? null
    } catch (err) {
      console.error('[AdminJobDetailPage] local demo data read failed:', err)
    }
  }

  if (isDemoAuthEnabled() && !order) notFound()

  // Fallback demo order if not in DB yet
  if (!order) {
    order = {
      id,
      customer_id: 'demo-user',
      product_id: 'sample-0',
      status: 'proof_approved',
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
      },
      customer: {
        full_name: 'Apex Racing Co.',
        email: 'operations@apexracing.com',
        company: 'Apex Racing Team',
      },
      product: {
        name: 'Race & Event Numbers',
        division: 'race-event-numbers',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  if (!order) {
    return null
  }

  const cfg = (order.config_snapshot || {}) as {
    size?: { label?: string; width_mm?: number; height_mm?: number }
    material?: { label?: string }
    bleed_mm?: number
    resolution_dpi?: number
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono mb-1">
            <Link href="/admin/jobs" className="hover:text-amber-400">
              Order progress
            </Link>
            <span>›</span>
            <span>Job #{order.id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Job #{order.id.slice(0, 8)}</h1>
            <Badge status={order.status} />
          </div>
        </div>

        <div className="flex gap-2">
          <a
            href={`/api/print-engine/generate?order_id=${order.id}`}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-2"
          >
            <span>📄</span>
            <span>Direct PDF Stream</span>
          </a>
        </div>
      </div>

      {/* Main Admin Controller */}
      <AdminJobActions
        orderId={order.id}
        currentStatus={order.status}
        isRaceNumber={order.product?.division === 'race-event-numbers'}
      />

      {/* Job Specifications & Customer Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-neutral-800/40 p-6 rounded-2xl border border-neutral-700/60 space-y-3 text-xs">
          <h3 className="font-bold text-white text-sm pb-2 border-b border-neutral-700">
            Customer Profile
          </h3>
          <div className="flex justify-between text-neutral-300">
            <span>Name:</span>
            <span className="font-semibold text-white">{order.customer?.full_name || 'Retail Client'}</span>
          </div>
          <div className="flex justify-between text-neutral-300">
            <span>Email:</span>
            <span className="font-mono text-white">{order.customer?.email || 'N/A'}</span>
          </div>
          <div className="flex justify-between text-neutral-300">
            <span>Company:</span>
            <span className="text-white">{order.customer?.company || 'Personal Account'}</span>
          </div>
          <div className="flex justify-between text-neutral-300">
            <span>Order Date:</span>
            <span className="text-white">{new Date(order.created_at).toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-neutral-800/40 p-6 rounded-2xl border border-neutral-700/60 space-y-3 text-xs">
          <h3 className="font-bold text-white text-sm pb-2 border-b border-neutral-700">
            Production Specifications
          </h3>
          <div className="flex justify-between text-neutral-300">
            <span>Product:</span>
            <span className="font-semibold text-white">{order.product?.name || 'Custom Print'}</span>
          </div>
          <div className="flex justify-between text-neutral-300">
            <span>Size:</span>
            <span className="font-mono text-white">{cfg.size?.label || 'Custom'}</span>
          </div>
          <div className="flex justify-between text-neutral-300">
            <span>Material:</span>
            <span className="text-white">{cfg.material?.label || 'Standard'}</span>
          </div>
          <div className="flex justify-between text-neutral-300">
            <span>Run Quantity:</span>
            <span className="font-bold text-amber-400">{order.quantity} units</span>
          </div>
          <div className="flex justify-between text-neutral-300">
            <span>Bleed / DPI:</span>
            <span className="font-mono text-white">{cfg.bleed_mm ?? 3}mm / {cfg.resolution_dpi ?? 300} DPI</span>
          </div>
        </div>
      </div>

      {/* Proof Versions History */}
      <div className="bg-neutral-800/40 p-6 rounded-2xl border border-neutral-700/60">
        <h3 className="font-bold text-white text-sm mb-4">Proof Version Control &amp; Approval History</h3>
        {proofs.length === 0 ? (
          <p className="text-xs text-neutral-400">No proofs generated for this job yet.</p>
        ) : (
          <div className="space-y-4">
            {proofs.map((proof) => (
              <div
                key={proof.id}
                className="p-4 bg-neutral-900 rounded-xl border border-neutral-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Version {proof.version}</span>
                    <Badge
                      status={
                        proof.status === 'approved'
                          ? 'completed'
                          : proof.status === 'revision_requested'
                          ? 'pending_payment'
                          : 'proof_sent'
                      }
                      label={proof.status.replace('_', ' ')}
                    />
                  </div>
                  <p className="text-neutral-400 mt-1">
                    Created: {new Date(proof.created_at).toLocaleString()}
                    {proof.approved_at && ` · Approved: ${new Date(proof.approved_at).toLocaleString()}`}
                  </p>
                  {proof.change_notes && (
                    <p className="text-amber-400 mt-1">Note: {proof.change_notes}</p>
                  )}
                </div>

                <a
                  href={proof.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold shrink-0"
                >
                  Inspect Proof File &rarr;
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
