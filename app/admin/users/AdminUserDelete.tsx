'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  id: string
  email: string
}

export default function AdminUserDelete({ id, email }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  async function removeUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (confirmation !== email) return

    setError('')
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not delete user')
      setIsOpen(false)
      router.refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete user')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setConfirmation('')
          setError('')
          setIsOpen(true)
        }}
        className="ml-2 rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
      >
        Delete
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={removeUser}
            className="w-full max-w-lg space-y-4 rounded-2xl border border-red-500/30 bg-neutral-900 p-6 text-white shadow-xl"
          >
            <h2 className="text-lg font-bold">Delete user account?</h2>
            <p className="text-sm text-neutral-300">
              This permanently removes <span className="font-semibold text-white">{email}</span> from
              authentication and removes the profile. Accounts with orders, designs, or proof
              approvals are protected and cannot be deleted here.
            </p>
            <label className="block text-xs text-neutral-300">
              Type the email address to confirm
              <input
                autoComplete="off"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-sm text-white"
              />
            </label>
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isDeleting}
                className="rounded-lg px-4 py-2 text-xs text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isDeleting || confirmation !== email}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Permanently delete'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
