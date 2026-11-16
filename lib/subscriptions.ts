import type { CustomerSubscriptionStatus } from '@/types'

function isCustomerSubscriptionStatus(
  status: string
): status is CustomerSubscriptionStatus {
  switch (status) {
    case 'created':
    case 'authenticated':
    case 'active':
    case 'pending':
    case 'halted':
    case 'paused':
    case 'cancelled':
    case 'completed':
    case 'expired':
      return true
    default:
      return false
  }
}

export function normalizeSubscriptionStatus(
  status: unknown
): CustomerSubscriptionStatus | null {
  return typeof status === 'string' && isCustomerSubscriptionStatus(status)
    ? status
    : null
}

export function razorpayTimestampToIso(value: unknown): string | null {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 8_640_000_000
  ) {
    return null
  }

  return new Date(value * 1000).toISOString()
}
