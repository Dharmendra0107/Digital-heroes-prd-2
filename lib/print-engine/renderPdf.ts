import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas'
import { createRequire } from 'node:module'
import { sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'

const MAX_PDF_BYTES = 8_000_000
const MAX_PDF_PAGE_POINTS = 20_000
const require = createRequire(`${process.cwd()}${sep}package.json`)

export async function renderSinglePagePdfDataUrl(
  dataUrl: string,
  width: number,
  height: number
): Promise<string> {
  const match = /^data:application\/pdf;base64,([a-z\d+/]+=*)$/i.exec(dataUrl)
  if (!match) {
    throw new Error('PDF artwork must be embedded as a base64 PDF upload')
  }
  const bytes = Buffer.from(match[1], 'base64')
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error('PDF artwork must be between 1 byte and 8 MB')
  }
  if (bytes.toString('ascii', 0, 5) !== '%PDF-') {
    throw new Error('Uploaded file is not a valid PDF document')
  }
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 12_000 ||
    height > 12_000 ||
    width * height > 40_000_000
  ) {
    throw new Error('PDF preview dimensions exceed the safe raster limits')
  }
  Object.assign(globalThis, { DOMMatrix, ImageData, Path2D })
  GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
  ).href

  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: true,
    stopAtErrors: true,
    maxImageSize: 40_000_000,
    verbosity: 0,
  })
  const pdf = await loadingTask.promise
  try {
    if (pdf.numPages !== 1) {
      throw new Error('Only single-page PDF artwork is supported')
    }

    const page = await pdf.getPage(1)
    const pageViewport = page.getViewport({ scale: 1 })
    if (
      !Number.isFinite(pageViewport.width) ||
      !Number.isFinite(pageViewport.height) ||
      pageViewport.width <= 0 ||
      pageViewport.height <= 0 ||
      pageViewport.width > MAX_PDF_PAGE_POINTS ||
      pageViewport.height > MAX_PDF_PAGE_POINTS
    ) {
      throw new Error('PDF page dimensions exceed the safe conversion limits')
    }

    const scale = Math.min(width / pageViewport.width, height / pageViewport.height)
    const viewport = page.getViewport({ scale })
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    const offsetX = (width - viewport.width) / 2
    const offsetY = (height - viewport.height) / 2
    context.translate(offsetX, offsetY)
    await page.render({
      canvas: null,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
      background: '#ffffff',
    }).promise

    return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`
  } finally {
    await loadingTask.destroy()
  }
}
