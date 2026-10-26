'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  id: string
  name: string
  description: string
  basePrice: number
  active: boolean
}

export default function AdminProductEditor({
  id,
  name,
  description,
  basePrice,
  active,
}: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [productName, setProductName] = useState(name)
  const [productDescription, setProductDescription] = useState(description)
  const [price, setPrice] = useState(String(basePrice))
  const [isActive, setIsActive] = useState(active)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productName,
          description: productDescription,
          base_price_per_unit: Number(price),
          active: isActive,
        }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not save product')
      setIsOpen(false)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save product')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-neutral-700 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-600"
      >
        Edit
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={save} className="w-full max-w-lg space-y-4 rounded-2xl bg-neutral-900 p-6 text-white shadow-xl">
            <h2 className="text-lg font-bold">Edit product</h2>
            <label className="block text-xs text-neutral-300">
              Product name
              <input
                required
                maxLength={120}
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-neutral-300">
              Description
              <textarea
                maxLength={2000}
                rows={3}
                value={productDescription}
                onChange={(event) => setProductDescription(event.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-neutral-300">
              Base unit price (INR)
              <input
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                required
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-sm text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              Available to customers
            </label>
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg px-4 py-2 text-xs text-neutral-300 hover:bg-neutral-800">
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-black disabled:opacity-50">
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
