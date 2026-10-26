'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  fullName: string
  company: string
}

export default function ProfileSettingsForm({ fullName, company }: Props) {
  const router = useRouter()
  const [name, setName] = useState(fullName)
  const [companyName, setCompanyName] = useState(company)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, company: companyName }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not save your profile')

      setMessage({ text: 'Profile saved.' })
      router.refresh()
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Could not save your profile',
        error: true,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      onSubmit={saveProfile}
      className="max-w-2xl space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
    >
      <div>
        <label htmlFor="profile-name" className="mb-1 block text-xs font-semibold text-neutral-700">
          Full name
        </label>
        <input
          id="profile-name"
          autoComplete="name"
          maxLength={100}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-amber-500"
        />
      </div>

      <div>
        <label htmlFor="profile-company" className="mb-1 block text-xs font-semibold text-neutral-700">
          Company, club, or group
        </label>
        <input
          id="profile-company"
          autoComplete="organization"
          maxLength={120}
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-amber-500"
        />
      </div>

      {message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-xs ${
            message.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
      >
        {isSaving ? 'Saving...' : 'Save profile'}
      </button>
    </form>
  )
}
