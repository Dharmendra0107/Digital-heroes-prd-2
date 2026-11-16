export interface RazorpayCheckoutResponse {
  razorpay_order_id?: string
  razorpay_payment_id?: string
  razorpay_subscription_id?: string
  razorpay_signature?: string
}

export interface RazorpayCheckoutOptions {
  key: string
  amount?: number
  currency?: string
  order_id?: string
  subscription_id?: string
  name: string
  description: string
  prefill: { email: string }
  theme: { color: string }
  handler: (response: RazorpayCheckoutResponse) => void
  modal: { ondismiss: () => void }
}

export interface RazorpayCheckoutInstance {
  open: () => void
  on: (
    event: 'payment.failed',
    handler: (response: { error?: { description?: string } }) => void
  ) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance
  }
}
