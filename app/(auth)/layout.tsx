import { type ReactNode } from 'react'
import Link from 'next/link'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl tracking-tight text-neutral-900">
            <span className="text-amber-500">▲</span>
            <span>Digital Heroes</span>
          </Link>
          <p className="text-xs uppercase font-mono tracking-widest text-neutral-400 mt-1">
            Web-to-Print Portal
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
