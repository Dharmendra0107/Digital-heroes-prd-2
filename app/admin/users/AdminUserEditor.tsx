'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { UserRole } from '@/types'

interface Props {
  id: string
  fullName: string
  company: string
  role: UserRole
}

export default function AdminUserEditor({ id, fullName, company, role }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState(fullName)
  const [companyName, setCompanyName] = useState(company)
  const [userRole, setUserRole] = useState<UserRole>(role)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, company: companyName, role: userRole }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not save user')
      setIsOpen(false)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save user')
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
            <h2 className="text-lg font-bold">Edit user</h2>
            <label className="block text-xs text-neutral-300">
              Full name
              <input
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-neutral-300">
              Company, club, or group
              <input
                maxLength={120}
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-neutral-300">
              Account role
              <select
                value={userRole}
                onChange={(event) => setUserRole(event.target.value as UserRole)}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-sm text-white"
              >
                <option value="customer">Customer</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            <p className="text-xs text-neutral-400">
              The final administrator cannot be changed to a customer.
            </p>
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
