import bwipjs from 'bwip-js/node'
import JSZip from 'jszip'
import { type NextRequest } from 'next/server'
import { getAppSession } from '@/lib/app-session'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { readDemoStore } from '@/lib/demo-store'
import { processVariableDataCSV } from '@/lib/print-engine/csvMerge'
import {
  generatePrintPDF,
  generatePrintPNG,
} from '@/lib/print-engine/generateFiles'
import { renderSavedArtworkSvg } from '@/lib/print-engine/renderArtwork'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { Design, Order, Product, Proof } from '@/types'

export const runtime = 'nodejs'

type OrderForPrint = Order & { product?: Product }

const MAX_CSV_BYTES = 1_000_000
const MAX_ROWS = 100

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&apos;',
    }
    return entities[character]
  })
}

function getPrintSize(order: OrderForPrint) {
  const size = order.config_snapshot.size as
    | { width_mm?: number; height_mm?: number }
    | undefined
  return {
    widthMm: size?.width_mm ?? 200,
    heightMm: size?.height_mm ?? 150,
    bleedMm:
      typeof order.config_snapshot.bleed_mm === 'number'
        ? order.config_snapshot.bleed_mm
        : 3,
    resolutionDpi:
      typeof order.config_snapshot.resolution_dpi === 'number'
        ? order.config_snapshot.resolution_dpi
        : 300,
  }
}

async function loadOrderAssets(orderId: string): Promise<{
  order: OrderForPrint | null
  design: Design | null
  latestProof: Proof | null
}> {
  if (isDemoAuthEnabled()) {
    const store = readDemoStore()
    return {
      order: store.orders.find((order) => order.id === orderId) ?? null,
      design: store.designs.find((item) => item.order_id === orderId) ?? null,
      latestProof:
        store.proofs
          .filter((proof) => proof.order_id === orderId)
          .sort((a, b) => b.version - a.version)[0] ?? null,
    }
  }

  const admin = createSupabaseAdminClient()
  const [orderResult, designResult, proofResult] = await Promise.all([
    admin.from('orders').select('*, product:products(*)').eq('id', orderId).maybeSingle(),
    admin.from('designs').select('*').eq('order_id', orderId).maybeSingle(),
    admin
      .from('proofs')
      .select('*')
      .eq('order_id', orderId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (orderResult.error) throw orderResult.error
  if (designResult.error) throw designResult.error
  if (proofResult.error) throw proofResult.error

  return {
    order: orderResult.data as OrderForPrint | null,
    design: designResult.data as Design | null,
    latestProof: proofResult.data as Proof | null,
  }
}

export async function POST(request: NextRequest) {
  const session = await getAppSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') {
    return Response.json({ error: 'Only admins can process variable data files' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const orderId = formData.get('order_id')
    const csvFile = formData.get('file')

    if (typeof orderId !== 'string' || !orderId.trim()) {
      return Response.json({ error: 'Missing order_id' }, { status: 400 })
    }
    if (!(csvFile instanceof File) || !csvFile.name.toLowerCase().endsWith('.csv')) {
      return Response.json({ error: 'Please provide a CSV file' }, { status: 400 })
    }
    if (csvFile.size === 0 || csvFile.size > MAX_CSV_BYTES) {
      return Response.json({ error: 'CSV file must be between 1 byte and 1 MB' }, { status: 413 })
    }

    let orderAssets: Awaited<ReturnType<typeof loadOrderAssets>>
    try {
      orderAssets = await loadOrderAssets(orderId)
    } catch (error) {
      console.error('[print-engine CSV merge] failed to load order artwork:', error)
      return Response.json({ error: 'Could not load the order artwork' }, { status: 500 })
    }
    const { order, design, latestProof } = orderAssets
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
    if (order.product?.division !== 'race-event-numbers') {
      return Response.json({ error: 'Variable-data batches are only available for race-number orders' }, { status: 400 })
    }
    if (order.status !== 'proof_approved' && order.status !== 'in_production' && order.status !== 'completed') {
      return Response.json({ error: 'The order must have an approved proof before batch output is available' }, { status: 403 })
    }
    if (latestProof?.status !== 'approved') {
      return Response.json({ error: 'The latest proof must be approved before batch output is available' }, { status: 403 })
    }
    if (!design) return Response.json({ error: 'No saved artwork is available for this order' }, { status: 409 })

    const result = processVariableDataCSV(await csvFile.text())
    if (result.errors.length > 0 && result.validRows === 0) {
      return Response.json({ error: 'CSV validation failed', details: result.errors }, { status: 422 })
    }
    if (result.validRows > MAX_ROWS) {
      return Response.json({ error: `A batch can contain at most ${MAX_ROWS} valid rows` }, { status: 422 })
    }
    if (result.validRows === 0) {
      return Response.json({ error: 'CSV contains no valid records', details: result.errors }, { status: 422 })
    }

    const dimensions = getPrintSize(order)
    const outputPixelsPerRow =
      Math.ceil(((dimensions.widthMm + dimensions.bleedMm * 2) / 25.4) * dimensions.resolutionDpi) *
      Math.ceil(((dimensions.heightMm + dimensions.bleedMm * 2) / 25.4) * dimensions.resolutionDpi)
    if (!Number.isFinite(outputPixelsPerRow) || outputPixelsPerRow * result.validRows > 20_000_000) {
      return Response.json(
        { error: 'This batch is too large to render safely. Reduce the row count or print size.' },
        { status: 413 }
      )
    }

    const baseArtwork = await renderSavedArtworkSvg(
      design.canvas_json || undefined,
      (design.upload_type === 'pdf'
        ? design.upload_url || design.thumbnail_url
        : design.thumbnail_url || design.upload_url) || undefined,
      dimensions.widthMm,
      dimensions.heightMm,
      design.upload_type
    )
    const svgViewBox = baseArtwork.match(/viewBox="[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)"/i)
    const viewHeight = svgViewBox
      ? Number(svgViewBox[2])
      : Math.max(1, Math.round((dimensions.heightMm / dimensions.widthMm) * 600))
    const archive = new JSZip()
    const outputFolder = archive.folder('print-files')
    if (!outputFolder) throw new Error('Could not create the output archive')

    for (const record of result.records) {
      const barcode = await bwipjs.toBuffer({
        bcid: 'code128',
        text: record.barcodeData || `DH-${record.number}`,
        scale: 2,
        height: 12,
        includetext: false,
        padding: 2,
      })
      const barcodeDataUrl = `data:image/png;base64,${barcode.toString('base64')}`
      const panelHeight = Math.min(150, viewHeight)
      const panelY = viewHeight - panelHeight
      const numberSize = Math.max(14, Math.min(60, Math.floor(panelHeight * 0.4), Math.floor(520 / record.number.length)))
      const nameSize = Math.max(10, Math.floor(panelHeight * 0.14))
      const categorySize = Math.max(9, Math.floor(panelHeight * 0.1))
      const barcodeHeight = panelHeight * 0.22
      const barcodeY = panelY + panelHeight - barcodeHeight
      const name = record.name ? escapeXml(record.name) : ''
      const category = record.category ? escapeXml(record.category) : ''
      const rowOverlay = `<g><rect x="18" y="${panelY}" width="564" height="${panelHeight}" rx="12" fill="#ffffff" fill-opacity=".94"/><text x="300" y="${panelY + panelHeight * 0.35}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${numberSize}" font-weight="700" fill="#111">${escapeXml(record.number)}</text>${name ? `<text x="300" y="${panelY + panelHeight * 0.56}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${nameSize}" fill="#222">${name}</text>` : ''}${category ? `<text x="300" y="${panelY + panelHeight * 0.72}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${categorySize}" fill="#444">${category}</text>` : ''}<image href="${barcodeDataUrl}" x="205" y="${barcodeY}" width="190" height="${barcodeHeight}" preserveAspectRatio="xMidYMid meet"/></g>`
      const personalizedArtwork = baseArtwork.replace('</svg>', `${rowOverlay}</svg>`)
      const png = await generatePrintPNG(
        {
          ...dimensions,
          orderId: order.id,
          productName: order.product?.name || 'Custom print',
          division: order.product?.division || 'labels-stickers',
          quantity: 1,
        },
        personalizedArtwork
      )
      const pdf = await generatePrintPDF(
        {
          ...dimensions,
          orderId: `${order.id}-row-${record.rowIndex}`,
          productName: order.product?.name || 'Custom print',
          division: order.product?.division || 'labels-stickers',
          quantity: 1,
        },
        png
      )
      const rowName = `row-${String(record.rowIndex).padStart(3, '0')}`
      outputFolder.file(`${rowName}.pdf`, pdf)
      outputFolder.file(`${rowName}.png`, png)
    }

    if (result.errors.length) {
      archive.file('batch-report.txt', result.errors.join('\r\n'))
    }
    const zip = await archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${order.id}_variable-data.zip"`,
        'Cache-Control': 'private, no-store',
        'X-Processed-Rows': String(result.validRows),
        'X-Skipped-Rows': String(result.errors.length),
      },
    })
  } catch (error) {
    console.error('[print-engine CSV merge] batch generation failed:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not generate batch print files' },
      { status: 422 }
    )
  }
}
