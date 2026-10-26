import PDFDocument from 'pdfkit'
import sharp from 'sharp'

interface OrderPrintMetadata {
  orderId: string
  productName: string
  division: string
  quantity: number
  sizeLabel?: string
  widthMm?: number
  heightMm?: number
  material?: string
  bleedMm?: number
  resolutionDpi?: number
  customerEmail?: string
}

/**
 * Rasterize the saved canvas artwork at the configured physical print resolution.
 */
export async function generatePrintPNG(
  meta: OrderPrintMetadata,
  artworkSvg: string
): Promise<Buffer> {
  const widthMm = meta.widthMm ?? 200
  const heightMm = meta.heightMm ?? 150
  const bleedMm = meta.bleedMm ?? 3
  const resolutionDpi = meta.resolutionDpi ?? 300
  const widthPx = Math.round((widthMm / 25.4) * resolutionDpi)
  const heightPx = Math.round((heightMm / 25.4) * resolutionDpi)
  const bleedPx = Math.round((bleedMm / 25.4) * resolutionDpi)
  const totalWidthPx = widthPx + bleedPx * 2
  const totalHeightPx = heightPx + bleedPx * 2

  if (
    !Number.isFinite(widthPx) ||
    !Number.isFinite(heightPx) ||
    widthPx < 1 ||
    heightPx < 1 ||
    totalWidthPx > 12_000 ||
    totalHeightPx > 12_000 ||
    totalWidthPx * totalHeightPx > 40_000_000
  ) {
    throw new Error('Configured print size exceeds the safe raster output limits')
  }

  const trimArtwork = await sharp(Buffer.from(artworkSvg))
    .resize(widthPx, heightPx, { fit: 'fill' })
    .png()
    .toBuffer()

  return sharp(trimArtwork)
    .flatten({ background: '#ffffff' })
    .extend({
      top: bleedPx,
      bottom: bleedPx,
      left: bleedPx,
      right: bleedPx,
      extendWith: 'copy',
    })
    .png()
    .withMetadata({ density: resolutionDpi })
    .toBuffer()
}

/**
 * Build a PDF with the customer artwork, bleed, and trim marks.
 */
export async function generatePrintPDF(
  meta: OrderPrintMetadata,
  artworkPng: Buffer
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const mmToPt = (mm: number) => (mm * 72) / 25.4
    const bleedMm = meta.bleedMm ?? 3
    const widthMm = meta.widthMm ?? 200
    const heightMm = meta.heightMm ?? 150
    const totalW = mmToPt(widthMm + bleedMm * 2)
    const totalH = mmToPt(heightMm + bleedMm * 2)
    const bleedPt = mmToPt(bleedMm)
    const doc = new PDFDocument({
      size: [totalW, totalH],
      margin: 0,
      info: {
        Title: `PrintReady_${meta.orderId}`,
        Author: 'Digital Heroes Web-to-Print Engine',
        Subject: `Production run: ${meta.quantity} units of ${meta.productName}`,
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.image(artworkPng, 0, 0, { width: totalW, height: totalH })
    doc.rect(bleedPt, bleedPt, mmToPt(widthMm), mmToPt(heightMm))
      .lineWidth(0.5)
      .strokeColor('#00ffff')
      .stroke()

    const markLength = Math.min(15, bleedPt)
    doc.lineWidth(0.5).strokeColor('#000000')
    doc.moveTo(bleedPt, 0).lineTo(bleedPt, markLength).stroke()
    doc.moveTo(0, bleedPt).lineTo(markLength, bleedPt).stroke()
    doc.moveTo(totalW - bleedPt, 0).lineTo(totalW - bleedPt, markLength).stroke()
    doc.moveTo(totalW, bleedPt).lineTo(totalW - markLength, bleedPt).stroke()
    doc.moveTo(bleedPt, totalH).lineTo(bleedPt, totalH - markLength).stroke()
    doc.moveTo(0, totalH - bleedPt).lineTo(markLength, totalH - bleedPt).stroke()
    doc.moveTo(totalW - bleedPt, totalH).lineTo(totalW - bleedPt, totalH - markLength).stroke()
    doc.moveTo(totalW, totalH - bleedPt).lineTo(totalW - markLength, totalH - bleedPt).stroke()
    doc.end()
  })
}
