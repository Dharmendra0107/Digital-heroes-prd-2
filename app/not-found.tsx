import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="bg-amber-100 text-amber-800 text-4xl p-4 rounded-2xl mb-4 font-bold">
        404
      </div>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Page Not Found</h1>
      <p className="text-neutral-500 text-sm max-w-md mb-6">
        The print division, product, or order record you are looking for does not exist or has been
        moved.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
      >
        Return to Homepage &rarr;
      </Link>
    </div>
  )
}
