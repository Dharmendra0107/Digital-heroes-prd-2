import {
  orderCompletedEmail,
  orderConfirmedEmail,
  proofReadyEmail,
} from '@/lib/email/templates'
import { sendEmail, type EmailDelivery } from '@/lib/email/send'

async function deliver(
  event: string,
  recipient: string,
  message: { subject: string; html: string }
): Promise<EmailDelivery> {
  if (!recipient) {
    console.error(`[Email] Cannot send ${event} notification without a customer email`)
    return { status: 'failed', message: 'Customer email is missing' }
  }
  const result = await sendEmail(recipient, message.subject, message.html)
  if (result.status === 'skipped') {
    console.info(`[Email] ${event} notification was not sent: no email provider is configured`)
  } else if (result.status === 'failed') {
    console.error(`[Email] ${event} notification failed:`, result.message)
  }
  return result
}

export function notifyOrderReceived(
  recipient: string,
  orderId: string,
  customerName: string,
  productName: string,
  total: number
) {
  return deliver(
    'order received',
    recipient,
    orderConfirmedEmail(orderId, customerName, productName, total)
  )
}

export function notifyProofReady(
  recipient: string,
  orderId: string,
  customerName: string,
  version: number
) {
  return deliver('proof ready', recipient, proofReadyEmail(orderId, customerName, version))
}

export function notifyOrderCompleted(
  recipient: string,
  orderId: string,
  customerName: string
) {
  return deliver('order completed', recipient, orderCompletedEmail(orderId, customerName))
}
