'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DemoModeBanner() {
  const router = useRouter()
  const [error, setError] = useState('')

  const switchAccount = async () => {
    setError('')
    const response = await fetch('/api/demo-auth', { method: 'DELETE' })
    if (!response.ok) {
      setError('Could not end the demo session. Please reload and try again.')
      return
    }

    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="bg-amber-100 border-b border-amber-200 text-amber-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-4 text-xs">
        <span>Local demo mode — order workflow data is saved only on this development machine.</span>
        <button
          type="button"
          onClick={switchAccount}
          className="font-semibold underline underline-offset-2"
        >
          Switch demo account
        </button>
        {error && <span role="alert">{error}</span>}
      </div>
    </div>
  )
}
