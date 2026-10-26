import { randomUUID } from 'node:crypto'
import { type NextRequest } from 'next/server'
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from '@/lib/supabase/server'
import {
  generatePrintPDF,
  generatePrintPNG,
} from '@/lib/print-engine/generateFiles'
import { renderSavedArtworkSvg } from '@/lib/print-engine/renderArtwork'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { readDemoStore, updateDemoStore } from '@/lib/demo-store'
import type { Design, Order, PrintFile, Product } from '@/types'

type OrderForPrint = Order & { product?: Product }
type PrintAssets = { pdf: Buffer; png: Buffer }
type ArtworkSource = { design: Design | null; latestProofApproved: boolean }

const UNLOCKED_STATUSES = ['proof_approved', 'in_production', 'completed']

function isUnlocked(order: OrderForPrint) {
  return UNLOCKED_STATUSES.includes(order.status)
}

async function loadArtworkSource(orderId: string): Promise<ArtworkSource> {
  if (isDemoAuthEnabled()) {
    const store = readDemoStore()
    const latestProof = store.proofs
      .filter((proof) => proof.order_id === orderId)
      .sort((a, b) => b.version - a.version)[0]
    return {
      design: store.designs.find((item) => item.order_id === orderId) ?? null,
      latestProofApproved: latestProof?.status === 'approved',
    }
  }

  const adminClient = createSupabaseAdminClient()
  const [designResult, proofResult] = await Promise.all([
    adminClient
      .from('designs')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle(),
    adminClient
      .from('proofs')
      .select('status')
      .eq('order_id', orderId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (designResult.error) throw designResult.error
  if (proofResult.error) throw proofResult.error
  return {
    design: designResult.data as Design | null,
    latestProofApproved: proofResult.data?.status === 'approved',
  }
}

function createPrintMetadata(order: OrderForPrint) {
  const config = order.config_snapshot
  const size = config.size as
    | { label?: string; width_mm?: number; height_mm?: number }
    | undefined
  const material = config.material as { label?: string } | undefined
  return {
    orderId: order.id,
    productName: order.product?.name || 'Custom Print Order',
    division: order.product?.division || 'labels-stickers',
    quantity: order.quantity,
    sizeLabel: size?.label || 'Custom size',
    widthMm: size?.width_mm,
    heightMm: size?.height_mm,
    material: material?.label || 'Standard',
    bleedMm: typeof config.bleed_mm === 'number' ? config.bleed_mm : 3,
    resolutionDpi:
      typeof config.resolution_dpi === 'number' ? config.resolution_dpi : 300,
  }
}

async function buildPrintAssets(
  order: OrderForPrint,
  design: Design
): Promise<PrintAssets> {
  const metadata = createPrintMetadata(order)
  const widthMm = metadata.widthMm ?? 200
  const heightMm = metadata.heightMm ?? 150
  const imageUrl = design.upload_type === 'pdf'
    ? design.upload_url || design.thumbnail_url
    : design.thumbnail_url || design.upload_url
  const artworkSvg = await renderSavedArtworkSvg(
    design.canvas_json,
    imageUrl,
    widthMm,
    heightMm,
    design.upload_type
  )

  const png = await generatePrintPNG(metadata, artworkSvg)
  const pdf = await generatePrintPDF(metadata, png)
  return { pdf, png }
}

function outputResponse(orderId: string, format: string | null, assets: PrintAssets) {
  if (format === 'png') {
    return new Response(new Uint8Array(assets.png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${orderId}_PrintReady.png"`,
        'Cache-Control': 'private, no-store',
      },
    })
  }
  if (format && format !== 'pdf') {
    return new Response('Unsupported output format', { status: 400 })
  }
  return new Response(new Uint8Array(assets.pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${orderId}_PrintReady.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

async function loadOrder(orderId: string): Promise<OrderForPrint | null> {
  if (isDemoAuthEnabled()) {
    return readDemoStore().orders.find((item) => item.id === orderId) ?? null
  }
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, product:products(*)')
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw error
  return data as OrderForPrint | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const orderId = searchParams.get('order_id')
  const format = searchParams.get('format')

  if (!orderId) return new Response('Missing order_id', { status: 400 })
  const session = await getAppSession()
  if (!session) return new Response('Unauthorized', { status: 401 })

  let order: OrderForPrint | null
  let source: ArtworkSource
  try {
    order = await loadOrder(orderId)
    if (!order) return new Response('Order not found', { status: 404 })
    if (session.role !== 'admin' && order.customer_id !== session.userId) {
      return new Response('Forbidden', { status: 403 })
    }
    if (!isUnlocked(order)) {
      return new Response(
        `Files are available after proof approval (current status: ${order.status})`,
        { status: 403 }
      )
    }
    source = await loadArtworkSource(orderId)
  } catch (error) {
    console.error('[print-engine GET] failed to load print inputs:', error)
    return new Response('Could not load the order artwork', { status: 500 })
  }

  if (!source.latestProofApproved) {
    return new Response('The latest proof must be approved before files are available', {
      status: 403,
    })
  }
  if (!source.design) {
    return new Response('No saved artwork is available for this order', { status: 409 })
  }

  try {
    const assets = await buildPrintAssets(order, source.design)
    return outputResponse(orderId, format, assets)
  } catch (error) {
    console.error('[print-engine GET] artwork rendering failed:', error)
    return new Response(
      error instanceof Error ? error.message : 'Could not render the order artwork',
      { status: 422 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getAppSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') {
    return Response.json({ error: 'Only admins can prepare print files' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const orderId =
    typeof body === 'object' &&
    body !== null &&
    'order_id' in body &&
    typeof body.order_id === 'string'
      ? body.order_id
      : ''
  if (!orderId) return Response.json({ error: 'Missing order_id' }, { status: 400 })

  let order: OrderForPrint | null
  let source: ArtworkSource
  try {
    order = await loadOrder(orderId)
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
    if (!isUnlocked(order)) {
      return Response.json(
        { error: `Proof must be approved before preparing print files (status: ${order.status})` },
        { status: 403 }
      )
    }
    source = await loadArtworkSource(orderId)
  } catch (error) {
    console.error('[print-engine POST] failed to load print inputs:', error)
    return Response.json({ error: 'Could not load the order artwork' }, { status: 500 })
  }

  if (!source.latestProofApproved) {
    return Response.json(
      { error: 'The latest proof must be approved before preparing print files' },
      { status: 403 }
    )
  }
  if (!source.design) {
    return Response.json({ error: 'No saved artwork is available for this order' }, { status: 409 })
  }

  try {
    await buildPrintAssets(order, source.design)
  } catch (error) {
    console.error('[print-engine POST] artwork rendering failed:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not render the order artwork' },
      { status: 422 }
    )
  }

  const pdfUrl = `/api/print-engine/generate?order_id=${encodeURIComponent(orderId)}`
  const pngUrl = `${pdfUrl}&format=png`
  const now = new Date().toISOString()

  if (isDemoAuthEnabled()) {
    try {
      const result = updateDemoStore((store) => {
        const storedOrder = store.orders.find((item) => item.id === orderId)
        if (!storedOrder) return { error: 'Order not found', status: 404 as const }
        const latestProof = store.proofs
          .filter((proof) => proof.order_id === orderId)
          .sort((a, b) => b.version - a.version)[0]
        if (latestProof?.status !== 'approved') {
          return {
            error: 'The latest proof must be approved before preparing print files',
            status: 403 as const,
          }
        }

        const printFile: PrintFile = {
          id:
            store.printFiles.find((item) => item.order_id === orderId)?.id ??
            randomUUID(),
          order_id: orderId,
          pdf_url: pdfUrl,
          png_url: pngUrl,
          generated_at: now,
        }
        const existingIndex = store.printFiles.findIndex(
          (item) => item.order_id === orderId
        )
        if (existingIndex >= 0) store.printFiles[existingIndex] = printFile
        else store.printFiles.unshift(printFile)
        storedOrder.status = 'in_production'
        storedOrder.updated_at = now
        return { printFile }
      })
      if ('error' in result) {
        return Response.json({ error: result.error }, { status: result.status })
      }
      return Response.json({
        success: true,
        pdf_url: result.printFile.pdf_url,
        png_url: result.printFile.png_url,
        message: 'Print files are ready',
      })
    } catch (error) {
      console.error('[print-engine POST] failed to save local print files:', error)
      return Response.json({ error: 'Could not prepare the print files' }, { status: 500 })
    }
  }

  const adminClient = createSupabaseAdminClient()
  try {
    const { error: fileError } = await adminClient.from('print_files').upsert({
      order_id: orderId,
      pdf_url: pdfUrl,
      png_url: pngUrl,
      generated_at: now,
    })
    if (fileError) throw fileError
    const { error: statusError } = await adminClient
      .from('orders')
      .update({ status: 'in_production' })
      .eq('id', orderId)
    if (statusError) throw statusError
  } catch (error) {
    console.error('[print-engine POST] failed to record print files:', error)
    return Response.json({ error: 'Could not prepare the print files' }, { status: 500 })
  }

  return Response.json({
    success: true,
    pdf_url: pdfUrl,
    png_url: pngUrl,
    message: 'Print files are ready',
  })
}
