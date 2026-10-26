'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError caught]:', error)
  }, [error])

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="bg-red-100 text-red-700 text-3xl p-4 rounded-2xl mb-4">⚠️</div>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Something went wrong</h1>
      <p className="text-neutral-500 text-sm max-w-md mb-6">
        An error occurred while processing your print configuration or request.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
      >
        Try Again
      </button>
    </div>
  )
}
