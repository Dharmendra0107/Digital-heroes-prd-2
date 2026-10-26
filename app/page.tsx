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

const STEPS = [
  {
    icon: '⚙️',
    title: 'Configure',
    desc: 'Choose a product, size, material and quantity. See the price as you make changes.',
  },
  {
    icon: '🎨',
    title: 'Design',
    desc: 'Upload your artwork or make a simple design in the editor.',
  },
  {
    icon: '👁️',
    title: 'Proof',
    desc: 'Review your proof. Ask for changes or approve it.',
  },
  {
    icon: '📦',
    title: 'Receive',
    desc: 'Follow your order until it is ready.',
  },
]

const STATS = [
  { value: '6', label: 'Divisions' },
  { value: '300 DPI', label: 'Output quality' },
  { value: 'GST included', label: 'Clear pricing' },
  { value: 'Online', label: 'Price estimate' },
]

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6 border border-amber-200">
              <span>🏷️</span> Custom printing in India
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-neutral-900 mb-6 leading-tight">
              Custom printing,{' '}
              <span className="text-amber-500">made simple.</span>
            </h1>
            <p className="text-lg sm:text-xl text-neutral-600 mb-10 max-w-2xl leading-relaxed">
              Order labels, race numbers, trail signs, stamps, trophies and laser-cut items.
              Choose your options, check the price and review a proof before printing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 bg-amber-500 text-white font-semibold px-8 py-4 rounded-xl hover:bg-amber-600 transition-colors shadow-sm text-base"
              >
                Browse products →
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 bg-white text-neutral-800 font-semibold px-8 py-4 rounded-xl border border-neutral-300 hover:bg-neutral-50 transition-colors text-base"
              >
                Check prices
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="bg-amber-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center text-white">
                <div className="text-xl sm:text-2xl font-bold">{stat.value}</div>
                <div className="text-sm font-medium text-amber-100">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Division Hub */}
      <section className="bg-neutral-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-3">
              Our print divisions
            </h2>
            <p className="text-neutral-500 text-lg max-w-xl mx-auto">
              Choose what you need and see the available sizes, materials and prices.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {DIVISIONS.map((div) => (
              <Link
                key={div.slug}
                href={`/products/${div.slug}`}
                className="group bg-white rounded-2xl border border-neutral-200 p-6 hover:border-amber-400 hover:shadow-md transition-all"
              >
                <div className="text-4xl mb-4">{DIVISION_ICONS[div.slug]}</div>
                <h3 className="text-base font-semibold text-neutral-900 mb-1 group-hover:text-amber-600 transition-colors">
                  {div.name}
                </h3>
                <p className="text-sm text-neutral-500 mb-4 leading-snug">{div.tagline}</p>
                <span className="text-sm font-medium text-amber-500 group-hover:translate-x-1 inline-block transition-transform">
                  Explore →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20 border-t border-neutral-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-3">
              How it works
            </h2>
            <p className="text-neutral-500 text-lg max-w-xl mx-auto">
              From idea to doorstep in four simple steps.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(100%+0.5rem)] w-8 h-px bg-amber-200 z-0" />
                )}
                <div className="relative bg-neutral-50 rounded-2xl p-6 border border-neutral-100 h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{step.icon}</span>
                    <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">
                      Step {i + 1}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-neutral-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Teaser */}
      <section className="bg-neutral-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">See our work</h2>
          <p className="text-neutral-400 text-lg mb-8 max-w-xl mx-auto">
            View examples of printed products and custom work.
          </p>
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 bg-amber-500 text-white font-semibold px-8 py-4 rounded-xl hover:bg-amber-600 transition-colors"
          >
            Browse gallery →
          </Link>
        </div>
      </section>
    </div>
  )
}
