import { type ReactNode } from 'react'

interface CardProps {
  className?: string
  children: ReactNode
}

export default function Card({ className = '', children }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-neutral-200 shadow-sm ${className}`}>
      {children}
    </div>
  )
}
