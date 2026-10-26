'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Badge from '@/components/ui/Badge'
import type { Proof } from '@/types'

interface Props {
  proof: Proof
  orderId: string
  canApprove?: boolean
}

export default function ProofActions({ proof, orderId, canApprove = true }: Props) {
  const router = useRouter()
  const [showRevisionForm, setShowRevisionForm] = useState(false)
  const [changeNotes, setChangeNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to approve this proof? Once approved, your order will proceed directly to the production floor.')) {
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch(`/api/proofs/${proof.id}/approve`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve proof')
      }
      setSuccessMsg('Proof approved successfully! Production files have been unlocked.')
      router.refresh()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error approving proof')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestRevision = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!changeNotes.trim()) {
      setErrorMsg('Please specify what changes are needed')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch(`/api/proofs/${proof.id}/revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_notes: changeNotes }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit change request')
      }
      setSuccessMsg('Revision requested. Our team has been notified.')
      setShowRevisionForm(false)
      router.refresh()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error requesting revision')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-100 gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-neutral-900">
              Digital Proof (Version {proof.version})
            </h3>
            <Badge status={proof.status === 'approved' ? 'completed' : proof.status === 'revision_requested' ? 'pending_payment' : 'proof_sent'} label={proof.status.replace('_', ' ')} />
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Created: {new Date(proof.created_at).toLocaleString()}
          </p>
        </div>

        {proof.approved_at && (
          <div className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-medium">
            Approved: {new Date(proof.approved_at).toLocaleString()}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
          {successMsg}
        </div>
      )}

      {/* Proof Preview Display */}
      <div className="mb-6 flex flex-col items-center justify-center p-6 bg-neutral-100 rounded-xl border border-neutral-200 min-h-[300px]">
        {proof.file_url ? (
          <div className="max-w-md w-full bg-white shadow-md rounded-lg overflow-hidden border border-neutral-300">
            {/* If data URL or image */}
            {proof.file_url.startsWith('data:image') || proof.file_url.match(/\.(png|jpg|jpeg|webp)$/i) ? (
              <img
                src={proof.file_url}
                alt={`Proof v${proof.version}`}
                className="w-full h-auto object-contain max-h-[360px]"
              />
            ) : (
              <div className="p-8 text-center">
                <span className="text-4xl block mb-2">📄</span>
                <p className="font-semibold text-neutral-800 text-sm mb-1">
                  High-Resolution Digital Proof File
                </p>
                <a
                  href={proof.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-amber-600 font-semibold underline mt-2 inline-block"
                >
                  Open / Download Proof Document &rarr;
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="text-neutral-400 text-sm">No preview available</div>
        )}
      </div>

      {proof.change_notes && (
        <div className="mb-6 p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-700">
          <span className="font-semibold block mb-1 text-neutral-900">Requested Notes:</span>
          {proof.change_notes}
        </div>
      )}

      {/* Action Buttons if Pending */}
      {proof.status === 'pending' && canApprove && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
            >
              ✓ Approve Proof &amp; Release to Print
            </button>
            <button
              type="button"
              onClick={() => setShowRevisionForm(!showRevisionForm)}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 font-medium rounded-xl text-sm transition-colors"
            >
              ✎ Request Changes
            </button>
          </div>

          <p className="text-[11px] text-neutral-400">
            Approval locks the design. Once approved, the production engine generates final press files.
          </p>

          {showRevisionForm && (
            <form onSubmit={handleRequestRevision} className="mt-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
              <label className="block text-xs font-semibold text-neutral-700">
                What adjustments should be made?
              </label>
              <textarea
                required
                rows={3}
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                placeholder="E.g., Please shift the logo 5mm upward and make the font bolder..."
                className="w-full p-3 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRevisionForm(false)}
                  className="px-3 py-1.5 text-xs text-neutral-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs rounded-lg"
                >
                  Submit Revision Request
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
