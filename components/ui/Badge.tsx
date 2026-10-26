import type { OrderStatus } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  pending_payment: 'bg-neutral-100 text-neutral-700',
  paid: 'bg-blue-100 text-blue-700',
  artwork_pending: 'bg-blue-100 text-blue-700',
  proof_sent: 'bg-yellow-100 text-yellow-700',
  proof_approved: 'bg-green-100 text-green-700',
  in_production: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Pending Payment',
  paid: 'Paid',
  artwork_pending: 'Artwork Pending',
  proof_sent: 'Proof Sent',
  proof_approved: 'Proof Approved',
  in_production: 'In Production',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

interface BadgeProps {
  status: OrderStatus | string
  label?: string
}

export default function Badge({ status, label }: BadgeProps) {
  const style = STATUS_STYLES[status] ?? 'bg-neutral-100 text-neutral-600'
  const text = label ?? STATUS_LABELS[status] ?? status

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}
    >
      {text}
    </span>
  )
}
