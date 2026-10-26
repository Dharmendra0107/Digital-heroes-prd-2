import Link from 'next/link'
import { DIVISIONS } from '@/lib/products'

const DIVISION_ICONS: Record<string, string> = {
  'labels-stickers': '🏷️',
  'race-event-numbers': '🏁',
  'mtb-boards': '🚵',
  'stamps': '✉️',
  'trophies': '🏆',
  'laser-cut-work': '⚡',
}

export default function ProductsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-3">
          All print divisions
        </h1>
        <p className="text-neutral-500 text-lg max-w-2xl">
          Explore our six specialist print divisions. Click any division to see products, configure
          your order and get an instant quote.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {DIVISIONS.map((div) => (
          <div
            key={div.slug}
            className="bg-white rounded-2xl border border-neutral-200 p-6 hover:border-amber-400 hover:shadow-md transition-all flex flex-col"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="text-4xl">{DIVISION_ICONS[div.slug]}</div>
              <div>
                <h2 className="text-lg font-bold text-neutral-900">{div.name}</h2>
                <p className="text-sm font-medium text-amber-500 mt-0.5">{div.tagline}</p>
              </div>
            </div>
            <p className="text-sm text-neutral-600 leading-relaxed mb-6 flex-1">
              {div.description}
            </p>
            <Link
              href={`/products/${div.slug}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 hover:text-amber-700 transition-colors"
            >
              View products →
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
