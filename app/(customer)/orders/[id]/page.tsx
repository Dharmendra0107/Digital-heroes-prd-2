import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { readDemoStore } from '@/lib/demo-store'
import { formatINR } from '@/lib/currency'
import Badge from '@/components/ui/Badge'
import ProofActions from '@/components/dashboard/ProofActions'
import OrderActionButtons from '@/components/dashboard/OrderActionButtons'
import type { Order, Proof, PrintFile } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

const PIPELINE_STAGES = [
  { key: 'pending_payment', label: 'Quote / Checkout' },
  { key: 'artwork_pending', label: 'Artwork' },
  { key: 'proof_sent', label: 'Proof Approval' },
  { key: 'proof_approved', label: 'Proof approved' },
  { key: 'in_production', label: 'Production Floor' },
  { key: 'completed', label: 'Completed' },
]

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params

  const session = await getAppSession()

  if (!session) {
    redirect(`/login?next=/orders/${id}`)
  }

  // Fetch order, latest proofs, and print files
  let order: Order | null = null
  let proofs: Proof[] = []
  let printFile: PrintFile | null = null

  if (!isDemoAuthEnabled()) {
    const supabase = await createSupabaseServerClient()
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('*, product:products(*)')
        .eq('id', id)
        .single()

      if (orderData) {
        order = orderData as Order
      }

      const { data: proofData } = await supabase
        .from('proofs')
        .select('*')
        .eq('order_id', id)
        .order('version', { ascending: false })

      if (proofData) {
        proofs = proofData as Proof[]
      }

      const { data: fileData } = await supabase
        .from('print_files')
        .select('*')
        .eq('order_id', id)
        .single()

      if (fileData) {
        printFile = fileData as PrintFile
      }
    } catch (err) {
      console.error('[OrderDetailPage] error:', err)
    }
  } else {
    try {
      const store = readDemoStore()
      const demoOrder = store.orders.find((item) => item.id === id)
      if (demoOrder && (session.role === 'admin' || demoOrder.customer_id === session.userId)) {
        order = demoOrder
        proofs = store.proofs
          .filter((proof) => proof.order_id === id)
          .sort((a, b) => b.version - a.version)
        printFile = store.printFiles.find((file) => file.order_id === id) ?? null
      }
    } catch (err) {
      console.error('[OrderDetailPage] local demo data read failed:', err)
    }
  }

  if (isDemoAuthEnabled() && !order) notFound()

  // Fallback demo order if not in Supabase yet
  if (!order) {
    order = {
      id,
      customer_id: session.userId,
      product_id: 'sample-0',
      status: 'proof_sent',
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    // Demo proof
    proofs = [
      {
        id: `demo-proof-${id}`,
        order_id: id,
        version: 1,
        file_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280"><rect width="100%" height="100%" fill="%23fafafa"/><rect x="20" y="20" width="360" height="240" fill="none" stroke="%23f59e0b" stroke-width="2" stroke-dasharray="6,4"/><text x="200" y="140" font-family="sans-serif" font-size="20" font-weight="bold" fill="%23171717" text-anchor="middle">DIGITAL HEROES PROOF v1</text><text x="200" y="170" font-family="sans-serif" font-size="12" fill="%23737373" text-anchor="middle">300 DPI · 3mm Bleed Protected</text></svg>',
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    ]
  }

  const currentStageIndex = PIPELINE_STAGES.findIndex((s) => s.key === order?.status)
  const activeProof = proofs[0]
  const config = (order.config_snapshot || {}) as {
    size?: { label?: string; width_mm?: number; height_mm?: number }
    material?: { label?: string }
    bleed_mm?: number
    resolution_dpi?: number
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono mb-1">
            <Link href="/orders" className="hover:text-amber-500">
              Orders
            </Link>
            <span>›</span>
            <span>#{order.id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900">
              Order #{order.id.slice(0, 8)}
            </h1>
            <Badge status={order.status} />
          </div>
        </div>

        <OrderActionButtons orderId={order.id} status={order.status} demo={isDemoAuthEnabled()} />
      </div>

      {/* Order progress */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-6">
          Order progress
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isCompleted = currentStageIndex > idx || order?.status === 'completed'
            const isCurrent = currentStageIndex === idx && order?.status !== 'completed'
            return (
              <div
                key={stage.key}
                className={`p-3 rounded-xl border text-center transition-all ${
                  isCurrent
                    ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-500'
                    : isCompleted
                    ? 'border-emerald-300 bg-emerald-50/50 text-emerald-800'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-400'
                }`}
              >
                <div className="text-[10px] font-mono uppercase mb-0.5">
                  Step {idx + 1}
                </div>
                <div className="text-xs leading-tight">{stage.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Proof Review Section */}
      {activeProof && (
        <section>
          <div className="mb-3">
            <h2 className="text-lg font-bold text-neutral-900">Review your proof</h2>
            <p className="text-xs text-neutral-500">
              Review artwork boundaries, typography, and bleed before approving production.
            </p>
          </div>
          <ProofActions proof={activeProof} orderId={order.id} />
        </section>
      )}

      {/* If Artwork Pending, show prompt to launch designer */}
      {order.status === 'artwork_pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-amber-900">Artwork Required</h3>
            <p className="text-xs text-amber-700 mt-1">
              Your order has been captured. Launch our in-browser designer or upload your finished
              vector files now.
            </p>
          </div>
          <Link
            href={`/designer/${order.id}`}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors shrink-0"
          >
            Open Artwork Studio &rarr;
          </Link>
        </div>
      )}

      {/* Order Item Specifications & Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Specifications */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
          <h3 className="font-semibold text-neutral-900 pb-3 border-b border-neutral-100 text-sm">
            Item Specifications
          </h3>
          <div className="space-y-2.5 text-xs text-neutral-600">
            <div className="flex justify-between">
              <span>Product Line:</span>
              <span className="font-semibold text-neutral-900">
                {order.product?.name || 'Custom Print'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Dimension:</span>
              <span className="font-mono text-neutral-900">
                {config.size?.label || 'Custom'} ({config.size?.width_mm || 200}×{config.size?.height_mm || 150}mm)
              </span>
            </div>
            <div className="flex justify-between">
              <span>Material / Finish:</span>
              <span className="text-neutral-900">{config.material?.label || 'Standard'}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Run Quantity:</span>
              <span className="font-semibold text-neutral-900">{order.quantity} units</span>
            </div>
            <div className="flex justify-between">
              <span>Bleed Allowance:</span>
              <span className="font-mono text-neutral-900">{config.bleed_mm ?? 3} mm</span>
            </div>
            <div className="flex justify-between">
              <span>Resolution Target:</span>
              <span className="font-mono text-neutral-900">{config.resolution_dpi ?? 300} DPI</span>
            </div>
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
          <h3 className="font-semibold text-neutral-900 pb-3 border-b border-neutral-100 text-sm">
            Price details
          </h3>
          <div className="space-y-2.5 text-xs text-neutral-600">
            <div className="flex justify-between">
              <span>Unit Price (Discounted):</span>
              <span className="font-mono text-neutral-900">{formatINR(order.unit_price)}</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal ({order.quantity} units):</span>
              <span className="font-mono text-neutral-900">{formatINR(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST / Tax (18% inclusive):</span>
              <span className="font-mono text-neutral-900">{formatINR(order.tax_amount)}</span>
            </div>
            <div className="pt-3 border-t border-neutral-200 flex justify-between items-baseline font-bold">
              <span className="text-sm text-neutral-900">Order total:</span>
              <span className="text-xl font-mono text-neutral-900">{formatINR(order.total_price)}</span>
            </div>
            {order.stripe_payment_id && (
              <div className="pt-2 text-[10px] text-neutral-400 font-mono">
                Payment Ref: {order.stripe_payment_id}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Production Output / Downloads Section (Proof Approval Gate) */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
        <h3 className="font-semibold text-neutral-900 text-sm mb-2">Production Files</h3>
        {order.status === 'proof_approved' || order.status === 'in_production' || order.status === 'completed' ? (
          <div className="space-y-3">
            <p className="text-xs text-emerald-700 font-medium">
              ✓ Proof approved. Production files unlocked.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={printFile?.pdf_url || `/api/print-engine/generate?order_id=${order.id}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center gap-2"
              >
                <span>📄</span>
                <span>Download Print-Ready PDF (300 DPI)</span>
              </a>
              {printFile?.png_url && (
                <a
                  href={printFile.png_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-xl"
                >
                  Download Raster PNG
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-500 flex items-center gap-3">
            <span className="text-xl">🔒</span>
            <div>
              <span className="font-semibold text-neutral-700 block">
                Production Files Locked by Approval Gate
              </span>
              <span>
                To protect against unapproved print runs, production-ready files are generated and
                unlocked only after you sign off on your proof.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
