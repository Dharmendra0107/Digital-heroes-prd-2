import Link from 'next/link'

interface EmptyStateProps {
  icon?: string
  title: string
  description: string
  action?: { label: string; href: string }
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && <div className="text-5xl mb-4">{icon}</div>}
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">{title}</h3>
      <p className="text-sm text-neutral-500 max-w-sm mb-6">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
