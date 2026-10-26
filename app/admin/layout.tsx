import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAppSession } from '@/lib/app-session'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAppSession()

  if (!session) {
    redirect('/login?next=/admin/dashboard')
  }

  if (session.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="bg-neutral-900 min-h-screen text-neutral-100">
      {/* Admin Top Header */}
      <header className="border-b border-neutral-800 bg-black/40 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link href="/admin/dashboard" className="flex items-center gap-2 font-bold text-lg text-white">
                <span className="text-amber-500">⚙️</span>
                <span>Digital Heroes <span className="text-xs uppercase bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono ml-1">Admin</span></span>
              </Link>

              <nav className="hidden md:flex items-center gap-5 text-xs font-semibold">
                <Link href="/admin/dashboard" className="text-neutral-300 hover:text-white transition-colors">
                  Overview
                </Link>
                <Link href="/admin/jobs" className="text-neutral-300 hover:text-white transition-colors">
                  Orders
                </Link>
                <Link href="/admin/products" className="text-neutral-300 hover:text-white transition-colors">
                  Products
                </Link>
                <Link href="/admin/users" className="text-neutral-300 hover:text-white transition-colors">
                  Users
                </Link>
                <Link href="/admin/reports" className="text-neutral-300 hover:text-white transition-colors">
                  Reports
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-xs text-neutral-400 hover:text-white border border-neutral-700 px-3 py-1.5 rounded-lg"
              >
                Customer View &rarr;
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
