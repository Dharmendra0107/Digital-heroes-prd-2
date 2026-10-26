import Link from 'next/link'
import { type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-500 shadow-sm',
  secondary:
    'bg-white text-neutral-800 border border-neutral-300 hover:bg-neutral-50 focus-visible:ring-neutral-400 shadow-sm',
  ghost:
    'bg-transparent text-neutral-700 hover:bg-neutral-100 focus-visible:ring-neutral-400',
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-7 py-3.5 text-base rounded-xl gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  href?: string
  loading?: boolean
  children?: ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  href,
  loading = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'

  const cls = `${base} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`

  if (href) {
    return (
      <Link href={href} className={cls}>
        {loading ? <Spinner /> : null}
        {children}
      </Link>
    )
  }

  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}

function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  )
}
