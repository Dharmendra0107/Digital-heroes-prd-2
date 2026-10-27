'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderStatus } from '@/types'

interface Props {
  orderId: string
  currentStatus: OrderStatus
  isRaceNumber?: boolean
}

const STAGES: OrderStatus[] = [
  'pending_payment',
  'paid',
  'artwork_pending',
  'proof_sent',
  'proof_approved',
  'in_production',
  'completed',
  'cancelled',
]

export default function AdminJobActions({
  orderId,
  currentStatus,
  isRaceNumber,
}: Props) {
  const router = useRouter()
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(currentStatus)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCsvGenerating, setIsCsvGenerating] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvResult, setCsvResult] = useState<string>('')
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)

  const handleUpdateStatus = async () => {
    setIsUpdating(true)
    setMsg(null)

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus }),
      })
      const data = (await res.json()) as {
        error?: string
        notification?: { status: string; message?: string; reason?: string }
      }
      if (!res.ok) throw new Error(data.error || 'Failed to update stage')
      const notificationMessage =
        data.notification?.status === 'skipped'
          ? ' Email was not sent because Resend is not configured.'
          : data.notification?.status === 'failed'
            ? ` Email failed: ${data.notification.message || 'check server logs'}.`
            : data.notification?.status === 'sent'
              ? ' Customer email sent.'
              : ''
      setMsg({ text: `Order status updated to: ${selectedStatus}.${notificationMessage}` })
      router.refresh()
    } catch (err: unknown) {
      setMsg({
        text: err instanceof Error ? err.message : 'Error updating stage',
        error: true,
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleGeneratePrintFiles = async () => {
    setIsGenerating(true)
    setMsg(null)

    try {
      const res = await fetch('/api/print-engine/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setMsg({ text: 'Print file is ready.' })
      router.refresh()
    } catch (err: unknown) {
      setMsg({
        text: err instanceof Error ? err.message : 'Error generating production files',
        error: true,
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCsvMergeUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!csvFile) return

    setMsg(null)
    setCsvResult('')
    setIsCsvGenerating(true)

    try {
      const fd = new FormData()
      fd.append('order_id', orderId)
      fd.append('file', csvFile)

      const res = await fetch('/api/print-engine/csv-merge', {
        method: 'POST',
        body: fd,
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error || 'CSV merge failed')
      }

      const archive = await res.blob()
      const downloadUrl = URL.createObjectURL(archive)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${orderId}_variable-data.zip`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
      const processedRows = res.headers.get('X-Processed-Rows') || '0'
      const skippedRows = Number(res.headers.get('X-Skipped-Rows') || 0)
      setCsvResult(
        `Downloaded print files for ${processedRows} rows (${processedRows} PDFs and PNGs).` +
          (skippedRows ? ` ${skippedRows} row warning(s) are listed in batch-report.txt.` : '')
      )
      setCsvFile(null)
    } catch (err: unknown) {
      setMsg({
        text: err instanceof Error ? err.message : 'CSV processing error',
        error: true,
      })
    } finally {
      setIsCsvGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`p-4 rounded-xl text-xs font-medium ${
            msg.error
              ? 'bg-red-500/20 border border-red-500/40 text-red-200'
              : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Stage Controller */}
      <div className="bg-neutral-800/60 p-6 rounded-2xl border border-neutral-700/60">
        <h3 className="text-sm font-bold text-white mb-3">Update order status</h3>
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
            className="w-full sm:w-auto px-4 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleUpdateStatus}
            disabled={isUpdating || selectedStatus === currentStatus}
            className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-bold text-xs rounded-xl transition-colors"
          >
            {isUpdating ? 'Saving...' : 'Save status'}
          </button>
        </div>
      </div>

      {/* Production File Trigger */}
      <div className="bg-neutral-800/60 p-6 rounded-2xl border border-neutral-700/60 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white">Generate Print Master Files</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Runs PDFKit &amp; Sharp engine to produce 300 DPI trim/bleed print-ready files.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGeneratePrintFiles}
          disabled={isGenerating}
          className="px-5 py-2.5 bg-white hover:bg-neutral-100 text-black font-bold text-xs rounded-xl transition-colors shrink-0"
        >
          {isGenerating ? 'Generating...' : '⚡ Generate Production Output'}
        </button>
      </div>

      {/* Variable Data CSV Merge Box (especially for race numbers) */}
      {isRaceNumber && (
        <div className="bg-neutral-800/60 p-6 rounded-2xl border border-neutral-700/60">
          <h3 className="text-sm font-bold text-white mb-1">
            CSV Variable-Data Merge
          </h3>
          <p className="text-xs text-neutral-400 mb-4">
            Upload a CSV with number, name, category, and barcode columns to make a PDF and PNG
            for each row.
          </p>

          <form onSubmit={handleCsvMergeUpload} className="flex flex-col sm:flex-row gap-3 items-center">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              className="text-xs text-neutral-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-700 file:text-white"
            />
            <button
              type="submit"
              disabled={!csvFile || isCsvGenerating}
              className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 text-white font-semibold text-xs rounded-xl"
            >
              {isCsvGenerating ? 'Generating files...' : 'Download batch print files'}
            </button>
          </form>

          {csvResult && (
            <div className="mt-3 p-3 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs">
              {csvResult}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
