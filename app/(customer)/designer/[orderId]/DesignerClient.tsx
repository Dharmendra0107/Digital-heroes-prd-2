'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DesignerCanvas from '@/components/designer/DesignerCanvas'
import type { Order } from '@/types'

interface Props {
  order: Order
  initialDesignJson?: string
}

export default function DesignerClient({ order, initialDesignJson }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'editor' | 'upload'>('editor')
  const [isSaving, setIsSaving] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const config = (order.config_snapshot || {}) as {
    size?: { label: string; width_mm: number; height_mm: number }
    material?: { label: string }
    bleed_mm?: number
    resolution_dpi?: number
    print_area?: { x: number; y: number; width: number; height: number }
  }

  const widthMm = config.size?.width_mm || 200
  const heightMm = config.size?.height_mm || 150
  const printArea = config.print_area || {
    x: 5,
    y: 5,
    width: Math.max(10, widthMm - 10),
    height: Math.max(10, heightMm - 10),
  }

  // Handle saving canvas artwork
  const handleSaveCanvas = async (canvasJson: string, thumbnail: string) => {
    setIsSaving(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          canvas_json: canvasJson,
          thumbnail_url: thumbnail,
          upload_type: 'png',
          is_saved: true,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save design')
      }

      setSuccessMsg('Artwork saved! Redirecting to your proof...')
      setTimeout(() => {
        router.push(`/orders/${order.id}`)
      }, 1000)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error saving artwork')
      setIsSaving(false)
    }
  }

  // Handle direct file upload (PDF, PNG, SVG, AI)
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) {
      setErrorMsg('Please select a file to upload')
      return
    }

    setIsSaving(true)
    setErrorMsg('')

    try {
      // Determine format
      const ext = uploadFile.name.split('.').pop()?.toLowerCase() || 'png'
      const supportedTypes = ['pdf', 'png', 'svg', 'ai']
      if (!supportedTypes.includes(ext)) {
        throw new Error('Unsupported format. Allowed: PDF, PNG, SVG, AI')
      }

      if (uploadFile.size > 8 * 1024 * 1024) {
        throw new Error('File size must be 8 MB or less')
      }

      let thumbnailDataUrl = ''
      if (['png', 'jpg', 'jpeg', 'svg'].includes(ext)) {
        thumbnailDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result)
            else reject(new Error('Could not read selected file'))
          }
          reader.onerror = () => reject(new Error('Could not read selected file'))
          reader.readAsDataURL(uploadFile)
        })
      }

      const uploadDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result)
          else reject(new Error('Could not read selected file'))
        }
        reader.onerror = () => reject(new Error('Could not read selected file'))
        reader.readAsDataURL(uploadFile)
      })

      const res = await fetch('/api/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          upload_url: uploadDataUrl,
          upload_type: ext,
          thumbnail_url: thumbnailDataUrl || undefined,
          is_saved: true,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save artwork record')
      }

      setSuccessMsg('Artwork uploaded! Redirecting to proof review...')
      setTimeout(() => {
        router.push(`/orders/${order.id}`)
      }, 1000)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error uploading file')
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-neutral-200 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono mb-1">
            <Link href="/dashboard" className="hover:text-amber-500">
              Dashboard
            </Link>
            <span>›</span>
            <Link href={`/orders/${order.id}`} className="hover:text-amber-500">
              Order #{order.id.slice(0, 8)}
            </Link>
            <span>›</span>
            <span className="text-neutral-900 font-medium">Artwork Studio</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Prepare Your Print Artwork
          </h1>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'editor'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            🎨 In-Browser Designer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'upload'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            📁 Upload Finished Files
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium">
          {successMsg}
        </div>
      )}

      {/* Main Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Specification Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm text-sm">
            <h3 className="font-semibold text-neutral-900 mb-3 pb-2 border-b border-neutral-100">
              Job Specifications
            </h3>
            <div className="space-y-2 text-neutral-600 text-xs">
              <div className="flex justify-between">
                <span>Product:</span>
                <span className="font-medium text-neutral-900">
                  {order.product?.name || 'Custom Print'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Format:</span>
                <span className="font-mono text-neutral-900">
                  {widthMm}×{heightMm} mm
                </span>
              </div>
              <div className="flex justify-between">
                <span>Material:</span>
                <span className="text-neutral-900">{config.material?.label || 'Standard'}</span>
              </div>
              <div className="flex justify-between">
                <span>Quantity:</span>
                <span className="font-medium text-neutral-900">{order.quantity} units</span>
              </div>
              <div className="flex justify-between">
                <span>Print Bleed:</span>
                <span className="font-mono text-neutral-900">
                  {config.bleed_mm ?? 3} mm
                </span>
              </div>
              <div className="flex justify-between">
                <span>Target Resolution:</span>
                <span className="font-mono text-neutral-900">
                  {config.resolution_dpi ?? 300} DPI
                </span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-900 text-xs leading-relaxed">
            <p className="font-semibold mb-1">Print Safe Rules</p>
            <p>
              Keep key logos and typography inside the amber dashed guideline to ensure nothing is
              clipped during post-print guillotine trimming or die-cutting.
            </p>
          </div>
        </div>

        {/* Center / Right Canvas or Upload Form */}
        <div className="lg:col-span-9">
          {activeTab === 'editor' ? (
            <div className="space-y-4">
              <DesignerCanvas
                widthMm={widthMm}
                heightMm={heightMm}
                printArea={printArea}
                initialJson={initialDesignJson}
                onSave={handleSaveCanvas}
              />
              <div className="flex justify-between items-center text-xs text-neutral-400 px-1">
                <span>Changes can be revised prior to production approval.</span>
                {isSaving && <span className="text-amber-600 font-medium">Exporting proof...</span>}
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm max-w-xl">
              <h2 className="text-lg font-bold text-neutral-900 mb-2">
                Upload Print-Ready Artwork
              </h2>
              <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
                Already have production artwork from Illustrator, Photoshop, or InDesign? Upload it
                here. Supported formats: PDF, PNG, SVG, AI (max 5 MB).
              </p>

              <form onSubmit={handleFileUpload} className="space-y-6">
                <div className="border-2 border-dashed border-neutral-300 rounded-xl p-8 text-center hover:border-amber-500 transition-colors bg-neutral-50">
                  <input
                    type="file"
                    accept=".pdf,.png,.svg,.ai,image/png,application/pdf"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-neutral-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-white hover:file:bg-amber-600"
                  />
                  {uploadFile && (
                    <p className="mt-3 text-xs font-mono text-neutral-700">
                      Selected: {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!uploadFile || isSaving}
                  className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
                >
                  {isSaving ? 'Processing File...' : 'Upload & Proceed to Proof →'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
