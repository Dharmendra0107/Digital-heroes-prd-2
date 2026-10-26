import { StaticCanvas } from 'fabric/node'
import { renderSinglePagePdfDataUrl } from '@/lib/print-engine/renderPdf'

const MAX_CANVAS_JSON_LENGTH = 2_000_000
const MAX_EMBEDDED_IMAGE_BYTES = 5_000_000
const SAFE_IMAGE_DATA_URL =
  /^data:image\/(png|jpeg|webp|svg\+xml);(?:charset=[^;,]+;)?base64,([a-z\d+/]+=*)$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateEmbeddedImages(value: unknown, visited = { count: 0 }): void {
  if (Array.isArray(value)) {
    for (const item of value) validateEmbeddedImages(item, visited)
    return
  }
  if (!isRecord(value)) return

  visited.count += 1
  if (visited.count > 20_000) {
    throw new Error('Artwork contains too many canvas properties')
  }

  for (const [key, item] of Object.entries(value)) {
    if ((key === 'src' || key === 'href') && typeof item === 'string') {
      const match = SAFE_IMAGE_DATA_URL.exec(item)
      if (!match) {
        throw new Error('Artwork images must be embedded PNG, JPEG, WebP, or SVG files')
      }

      const image = Buffer.from(match[2], 'base64')
      if (image.byteLength > MAX_EMBEDDED_IMAGE_BYTES) {
        throw new Error('An embedded artwork image exceeds the 5 MB limit')
      }

      if (match[1].toLowerCase() === 'svg+xml') {
        const svg = image.toString('utf8')
        if (
          /<\s*(script|foreignObject)\b|(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|javascript:)|url\(\s*(?!#|data:)/i.test(
            svg
          )
        ) {
          throw new Error('Embedded SVG artwork must not contain scripts or external resources')
        }
      }
    }

    validateEmbeddedImages(item, visited)
  }
}

export async function renderSavedArtworkSvg(
  canvasJson: string | undefined,
  imageDataUrl: string | undefined,
  widthMm: number,
  heightMm: number,
  uploadType?: string
): Promise<string> {
  if (canvasJson) return renderCanvasArtworkSvg(canvasJson, widthMm, heightMm)
  if (!imageDataUrl) throw new Error('This order has no saved artwork')

  const width = 600
  const height = Math.max(1, Math.round((heightMm / widthMm) * width))
  if (uploadType === 'ai') {
    throw new Error('Illustrator files need a secured AI-to-PDF converter and cannot be rendered directly')
  }

  if (uploadType === 'pdf') {
    const pngDataUrl = await renderSinglePagePdfDataUrl(imageDataUrl, width, height)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/><image href="${pngDataUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/></svg>`
  }

  const match = SAFE_IMAGE_DATA_URL.exec(imageDataUrl)
  if (!match) {
    throw new Error('Saved file must be a PNG, JPEG, WebP, or self-contained SVG image')
  }
  const image = Buffer.from(match[2], 'base64')
  if (image.byteLength === 0 || image.byteLength > MAX_EMBEDDED_IMAGE_BYTES) {
    throw new Error('Saved artwork image must be between 1 byte and 5 MB')
  }

  if (match[1].toLowerCase() === 'svg+xml') {
    const svg = image.toString('utf8')
    if (
      !/<svg[\s>]/i.test(svg) ||
      /<\s*(script|foreignObject)\b|(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|javascript:)|url\(\s*(?!#|data:)/i.test(
        svg
      )
    ) {
      throw new Error('Uploaded SVG artwork must be self-contained and contain no scripts')
    }
  }

  const dataUrl = `data:image/${match[1].toLowerCase()};base64,${image.toString('base64')}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/><image href="${dataUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/></svg>`
}

export async function renderCanvasArtworkSvg(
  canvasJson: string,
  widthMm: number,
  heightMm: number
): Promise<string> {
  if (canvasJson.length > MAX_CANVAS_JSON_LENGTH) {
    throw new Error('Saved artwork exceeds the 2 MB print-render limit')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(canvasJson)
  } catch {
    throw new Error('Saved artwork is not valid canvas JSON')
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.objects)) {
    throw new Error('Saved artwork does not contain a canvas object list')
  }

  validateEmbeddedImages(parsed)

  const width = 600
  const height = Math.max(1, Math.round((heightMm / widthMm) * width))
  const canvas = new StaticCanvas(undefined, {
    width,
    height,
    backgroundColor: '#ffffff',
    renderOnAddRemove: false,
  })

  try {
    await canvas.loadFromJSON(parsed)

    for (const object of canvas.getObjects()) {
      const candidate = object as typeof object & {
        stroke?: string
        strokeDashArray?: number[] | null
        selectable?: boolean
      }
      if (
        candidate.stroke === '#f59e0b' &&
        Array.isArray(candidate.strokeDashArray) &&
        candidate.strokeDashArray.join(',') === '6,4' &&
        candidate.selectable === false
      ) {
        canvas.remove(object)
      }
    }

    return canvas.toSVG()
  } finally {
    await canvas.dispose()
  }
}
