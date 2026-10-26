import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAppSession } from '@/lib/app-session'

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAppSession()

  if (!session) {
    redirect('/login?next=/dashboard')
  }

  return (
    <div className="bg-neutral-50 min-h-screen">
      {/* Top Customer Navigation Bar */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4">
            <div>
              <span className="text-xs uppercase font-mono text-neutral-400">Account</span>
              <h1 className="text-xl font-bold text-neutral-900">
                {session.name || session.email.split('@')[0]}
                {session.company && (
                  <span className="text-xs font-normal text-neutral-500 ml-2">
                    ({session.company})
                  </span>
                )}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/products"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs rounded-xl transition-colors shadow-sm"
              >
                Start an order
              </Link>
            </div>
          </div>

          {/* Sub-nav tabs */}
          <div className="flex gap-6 text-xs sm:text-sm font-medium border-t border-neutral-100 pt-3 pb-2 overflow-x-auto">
            <Link
              href="/dashboard"
              className="text-neutral-700 hover:text-amber-600 transition-colors pb-2"
            >
              Overview
            </Link>
            <Link
              href="/orders"
              className="text-neutral-700 hover:text-amber-600 transition-colors pb-2"
            >
              My orders
            </Link>
            <Link
              href="/designs"
              className="text-neutral-700 hover:text-amber-600 transition-colors pb-2"
            >
              My designs
            </Link>
            <Link
              href="/pricing"
              className="text-neutral-700 hover:text-amber-600 transition-colors pb-2"
            >
              Pricing
            </Link>
            <Link
              href="/settings"
              className="text-neutral-700 hover:text-amber-600 transition-colors pb-2"
            >
              Account settings
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
    </div>
  )
}
