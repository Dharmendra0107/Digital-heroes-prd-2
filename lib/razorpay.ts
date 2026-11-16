import { createHmac, timingSafeEqual } from 'node:crypto'

export interface RazorpayOrder {
  id: string
  amount: number
  currency: string
  status: 'created' | 'attempted' | 'paid'
}

export interface RazorpayPayment {
  id: string
  order_id: string
  amount: number
  currency: string
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed'
}

export interface RazorpayPlan {
  id: string
  period: 'monthly' | 'yearly'
  interval: number
  item: {
    amount: number
    currency: string
    name: string
    description?: string
  }
}

export type RazorpaySubscriptionStatus =
  | 'created'
  | 'authenticated'
  | 'active'
  | 'pending'
  | 'halted'
  | 'paused'
  | 'cancelled'
  | 'completed'
  | 'expired'

export interface RazorpaySubscription {
  id: string
  plan_id: string
  status: RazorpaySubscriptionStatus
  current_start?: number | null
  current_end?: number | null
  charge_at?: number | null
  total_count?: number
  paid_count?: number
  has_scheduled_changes?: boolean
  notes?: Record<string, string>
}

export function isRazorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

export async function razorpayRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    throw new Error('Razorpay API credentials are not configured')
  }

  const headers = new Headers(init.headers)
  headers.set(
    'Authorization',
    `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`
  )
  headers.set('Content-Type', 'application/json')

  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })
  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(`Razorpay API request failed with status ${response.status}`)
  }

  try {
    return JSON.parse(responseText) as T
  } catch {
    throw new Error('Razorpay returned an invalid response')
  }
}

function isValidHmac(payload: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false
  const expected = createHmac('sha256', secret).update(payload).digest()
  const supplied = Buffer.from(signature, 'hex')
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function verifyRazorpayCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string
) {
  const secret = process.env.RAZORPAY_KEY_SECRET
  return Boolean(
    secret && isValidHmac(`${orderId}|${paymentId}`, signature, secret)
  )
}

export function verifyRazorpaySubscriptionSignature(
  subscriptionId: string,
  paymentId: string,
  signature: string
) {
  const secret = process.env.RAZORPAY_KEY_SECRET
  return Boolean(
    secret && isValidHmac(`${paymentId}|${subscriptionId}`, signature, secret)
  )
}

export function verifyRazorpayWebhookSignature(
  body: string,
  signature: string,
  secret: string
) {
  return isValidHmac(body, signature, secret)
}
