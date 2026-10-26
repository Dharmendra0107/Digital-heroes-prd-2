'use client'

import { useEffect, useRef, useState } from 'react'
import type { Canvas as FabricCanvas, FabricObject } from 'fabric'
import DesignerToolbar from './DesignerToolbar'

interface PrintArea {
  x: number
  y: number
  width: number
  height: number
}

interface DesignerCanvasProps {
  printArea?: PrintArea
  initialJson?: string
  widthMm?: number
  heightMm?: number
  onSave: (canvasJson: string, thumbnail: string) => void
}

export default function DesignerCanvas({
  printArea = { x: 5, y: 5, width: 190, height: 140 },
  initialJson,
  widthMm = 200,
  heightMm = 150,
  onSave,
}: DesignerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fabricCanvasRef = useRef<FabricCanvas | null>(null)
  const canvasDisposePromiseRef = useRef<Promise<void>>(Promise.resolve())
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [fontSize, setFontSize] = useState<number>(24)
  const [fontFamily, setFontFamily] = useState<string>('Arial')
  const [tracking, setTracking] = useState<number>(0)
  const [minFontSize, setMinFontSize] = useState<number>(8)
  const [maxFontSize, setMaxFontSize] = useState<number>(72)
  const [color, setColor] = useState<string>('#000000')
  const [isBold, setIsBold] = useState<boolean>(false)
  const [isItalic, setIsItalic] = useState<boolean>(false)

  // Scale factor: fit within ~600px wide area
  const canvasWidth = 600
  const scale = canvasWidth / (widthMm || 200)
  const canvasHeight = Math.round((heightMm || 150) * scale)

  // Bounding box for printable area in scaled pixels
  const bounds = {
    left: Math.round(printArea.x * scale),
    top: Math.round(printArea.y * scale),
    width: Math.round(printArea.width * scale),
    height: Math.round(printArea.height * scale),
  }

  useEffect(() => {
    let isMounted = true

    async function initCanvas() {
      if (!canvasRef.current) return

      const { Canvas, Rect } = await import('fabric')
      await canvasDisposePromiseRef.current
      if (!isMounted || !canvasRef.current) return

      const canvas = new Canvas(canvasRef.current, {
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: '#ffffff',
        selection: true,
      })

      fabricCanvasRef.current = canvas

      // Printable zone indicator guide (non-selectable)
      const guideRect = new Rect({
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
        fill: 'transparent',
        stroke: '#f59e0b',
        strokeWidth: 1.5,
        strokeDashArray: [6, 4],
        excludeFromExport: true,
        selectable: false,
        evented: false,
        hoverCursor: 'default',
      })
      canvas.add(guideRect)

      // Object constraint logic: prevent moving/scaling outside print boundary
      canvas.on('object:moving', (e: { target?: FabricObject | null }) => {
        const obj = e.target
        if (!obj || obj === guideRect) return

        obj.setCoords()
        const objBounds = obj.getBoundingRect()

        if (objBounds.left < bounds.left) {
          obj.left = (obj.left ?? 0) + bounds.left - objBounds.left
        }
        if (objBounds.top < bounds.top) {
          obj.top = (obj.top ?? 0) + bounds.top - objBounds.top
        }
        if (objBounds.left + objBounds.width > bounds.left + bounds.width) {
          obj.left = (obj.left ?? 0) - (objBounds.left + objBounds.width - (bounds.left + bounds.width))
        }
        if (objBounds.top + objBounds.height > bounds.top + bounds.height) {
          obj.top = (obj.top ?? 0) - (objBounds.top + objBounds.height - (bounds.top + bounds.height))
        }
      })

      canvas.on('object:scaling', (e: { target?: FabricObject | null }) => {
        const obj = e.target
        if (!obj || obj === guideRect) return

        obj.setCoords()
        const objectBounds = obj.getBoundingRect()
        const scaleLimit = Math.min(
          1,
          bounds.width / Math.max(objectBounds.width, 1),
          bounds.height / Math.max(objectBounds.height, 1)
        )
        if (scaleLimit < 1) {
          obj.set({
            scaleX: (obj.scaleX ?? 1) * scaleLimit,
            scaleY: (obj.scaleY ?? 1) * scaleLimit,
          })
        }
        obj.setCoords()
      })

      if (initialJson) {
        try {
          await canvas.loadFromJSON(JSON.parse(initialJson))
        } catch (err) {
          console.warn('[DesignerCanvas] failed to load initial json:', err)
        }
      }

    }

    initCanvas()

    return () => {
      isMounted = false
      if (fabricCanvasRef.current) {
        const canvas = fabricCanvasRef.current
        fabricCanvasRef.current = null
        canvasDisposePromiseRef.current = Promise.resolve(canvas.dispose())
          .then(() => undefined)
          .catch((error: unknown) => {
            console.error('[DesignerCanvas] failed to dispose canvas:', error)
          })
      }
    }
  }, [
    widthMm,
    heightMm,
    initialJson,
    canvasHeight,
    bounds.height,
    bounds.left,
    bounds.top,
    bounds.width,
  ])

  // Toolbar Actions
  const handleAddText = async () => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    const { Textbox } = await import('fabric')
    const text = new Textbox('Sample Artwork Text', {
      left: bounds.left + 20,
      top: bounds.top + 20,
      width: Math.min(250, bounds.width - 40),
      fontSize,
      fill: color,
      fontWeight: isBold ? 'bold' : 'normal',
      fontStyle: isItalic ? 'italic' : 'normal',
      fontFamily: 'sans-serif',
      charSpacing: tracking,
    })

    text.set({
      fontFamily,
      fontSize: Math.min(maxFontSize, Math.max(minFontSize, fontSize)),
    })

    canvas.add(text)
    canvas.setActiveObject(text)
    canvas.renderAll()
  }

  const handleUploadImage = () => {
    fileInputRef.current?.click()
  }

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !fabricCanvasRef.current) return

    const reader = new FileReader()
    reader.onload = async (f) => {
      const dataUrl = f.target?.result as string
      const { FabricImage } = await import('fabric')

      const img = await FabricImage.fromURL(dataUrl)
      // Scale down image to fit within print bounds
      const maxW = bounds.width * 0.6
      const maxH = bounds.height * 0.6
      const scaleX = maxW / (img.width || 1)
      const scaleY = maxH / (img.height || 1)
      const imgScale = Math.min(scaleX, scaleY, 1)

      img.scale(imgScale)
      img.set({
        left: bounds.left + 20,
        top: bounds.top + 20,
      })

      const canvas = fabricCanvasRef.current
      if (!canvas) return

      canvas.add(img)
      canvas.setActiveObject(img)
      canvas.renderAll()
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleDeleteSelected = () => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const activeObjects = canvas.getActiveObjects()
    if (activeObjects && activeObjects.length > 0) {
      activeObjects.forEach((obj) => canvas.remove(obj))
      canvas.discardActiveObject()
      canvas.renderAll()
    }
  }

  const handleClearAll = () => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const objects = canvas.getObjects()
    // Remove everything except the guide rectangle
    objects.forEach((obj) => {
      if (obj.strokeDashArray) return // keep guide
      canvas.remove(obj)
    })
    canvas.renderAll()
  }

  const handleFontSizeChange = (size: number) => {
    const safeSize = Math.min(maxFontSize, Math.max(minFontSize, size))
    setFontSize(safeSize)
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active && active.type === 'textbox') {
      active.set('fontSize', safeSize)
      canvas.renderAll()
    }
  }

  const handleFontFamilyChange = (value: string) => {
    setFontFamily(value)
    const active = fabricCanvasRef.current?.getActiveObject()
    if (active?.type === 'textbox') {
      active.set('fontFamily', value)
      fabricCanvasRef.current?.renderAll()
    }
  }

  const handleTrackingChange = (value: number) => {
    const safeTracking = Math.min(500, Math.max(0, value))
    setTracking(safeTracking)
    const active = fabricCanvasRef.current?.getActiveObject()
    if (active?.type === 'textbox') {
      active.set('charSpacing', safeTracking)
      fabricCanvasRef.current?.renderAll()
    }
  }

  const handleFitText = () => {
    const canvas = fabricCanvasRef.current
    const active = canvas?.getActiveObject()
    if (!canvas || !active || active.type !== 'textbox') return

    const text = active as FabricObject & {
      fontSize?: number
      initDimensions?: () => void
      width?: number
    }
    const width = Math.max(1, Math.min(bounds.width, text.width ?? bounds.width))
    text.set({ width, fontSize: maxFontSize })
    text.initDimensions?.()
    let fittedSize = maxFontSize

    while (
      fittedSize > minFontSize &&
      (text.getScaledWidth() > bounds.width || text.getScaledHeight() > bounds.height)
    ) {
      fittedSize -= 1
      text.set('fontSize', fittedSize)
      text.initDimensions?.()
    }

    text.set({
      left: Math.max(bounds.left, Math.min(text.left ?? bounds.left, bounds.left + bounds.width - text.getScaledWidth())),
      top: Math.max(bounds.top, Math.min(text.top ?? bounds.top, bounds.top + bounds.height - text.getScaledHeight())),
    })
    text.setCoords()
    setFontSize(fittedSize)
    canvas.renderAll()
  }

  const handleColorChange = (newColor: string) => {
    setColor(newColor)
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active && active.type === 'textbox') {
      active.set('fill', newColor)
      canvas.renderAll()
    }
  }

  const handleToggleBold = () => {
    const next = !isBold
    setIsBold(next)
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active && active.type === 'textbox') {
      active.set('fontWeight', next ? 'bold' : 'normal')
      canvas.renderAll()
    }
  }

  const handleToggleItalic = () => {
    const next = !isItalic
    setIsItalic(next)
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active && active.type === 'textbox') {
      active.set('fontStyle', next ? 'italic' : 'normal')
      canvas.renderAll()
    }
  }

  const handleSave = () => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    // Export thumbnail
    const thumbnail = canvas.toDataURL({
      format: 'png',
      multiplier: 1.5,
    })

    const canvasJson = JSON.stringify(canvas.toJSON())
    onSave(canvasJson, thumbnail)
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      {/* Hidden file input for logo uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleImageFileChange}
        className="hidden"
      />

      {/* Editor Toolbar */}
      <DesignerToolbar
        onAddText={handleAddText}
        onUploadImage={handleUploadImage}
        onDeleteSelected={handleDeleteSelected}
        onClearAll={handleClearAll}
        onSave={handleSave}
        onFontSizeChange={handleFontSizeChange}
        onColorChange={handleColorChange}
        onToggleBold={handleToggleBold}
        onToggleItalic={handleToggleItalic}
        onFontFamilyChange={handleFontFamilyChange}
        onTrackingChange={handleTrackingChange}
        onFitText={handleFitText}
        onMinFontSizeChange={(size) => setMinFontSize(Math.min(200, Math.max(6, size)))}
        onMaxFontSizeChange={(size) => setMaxFontSize(Math.max(minFontSize, Math.min(200, size)))}
        fontSize={fontSize}
        fontFamily={fontFamily}
        tracking={tracking}
        minFontSize={minFontSize}
        maxFontSize={maxFontSize}
        color={color}
        isBold={isBold}
        isItalic={isItalic}
        fileInputRef={fileInputRef}
      />

      {/* Interactive Canvas Area */}
      <div className="p-6 bg-neutral-100 flex flex-col items-center justify-center min-h-[460px] overflow-auto">
        <div className="shadow-lg border border-neutral-300 rounded overflow-hidden bg-white relative">
          <canvas ref={canvasRef} />
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-neutral-500 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-amber-500 inline-block" />
            Printable Zone ({printArea.width}×{printArea.height}mm)
          </span>
          <span>·</span>
          <span>Constrained Boundary Enabled</span>
        </div>
      </div>
    </div>
  )
}
