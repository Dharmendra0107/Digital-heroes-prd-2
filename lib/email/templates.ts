import { formatINR } from '@/lib/currency'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })
}

/**
 * Digital Heroes transactional HTML email templates
 */

export function orderConfirmedEmail(
  orderId: string,
  customerName: string,
  productName: string,
  total: number
): { subject: string; html: string } {
  const safeName = escapeHtml(customerName)
  const safeProduct = escapeHtml(productName)
  return {
    subject: `Order Received: #${orderId.slice(0, 8)} — Digital Heroes`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #171717;">
        <h2 style="color: #f59e0b;">Digital Heroes</h2>
        <h3>Thank you, ${safeName}!</h3>
        <p>We've received your order <strong>#${orderId.slice(0, 8)}</strong> for <strong>${safeProduct}</strong>.</p>
        <p>Total amount: <strong>${formatINR(total)} (GST included)</strong></p>
        <p>We'll update you as your job moves through production. Sign in to your account to check its status.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/orders/${encodeURIComponent(orderId)}" style="display: inline-block; padding: 12px 24px; background: #f59e0b; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">View Order &rarr;</a>
      </div>
    `,
  }
}

export function proofReadyEmail(
  orderId: string,
  customerName: string,
  version: number
): { subject: string; html: string } {
  const safeName = escapeHtml(customerName)
  return {
    subject: `Digital Proof v${version} Ready for Review — Order #${orderId.slice(0, 8)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #171717;">
        <h2 style="color: #f59e0b;">Digital Heroes</h2>
        <h3>Your proof is ready for approval</h3>
        <p>Hi ${safeName},</p>
        <p>Our team has prepared proof ${version} for your order <strong>#${orderId.slice(0, 8)}</strong>.</p>
        <p>Please check that the artwork looks right. We will start printing after you approve it.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/orders/${encodeURIComponent(orderId)}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">Approve Proof &rarr;</a>
      </div>
    `,
  }
}

export function orderCompletedEmail(
  orderId: string,
  customerName: string
): { subject: string; html: string } {
  const safeName = escapeHtml(customerName)
  return {
    subject: `Job Dispatched: Order #${orderId.slice(0, 8)} is Completed!`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #171717;">
        <h2 style="color: #f59e0b;">Digital Heroes</h2>
        <h3>Your order has been completed</h3>
        <p>Hi ${safeName},</p>
        <p>Great news! Production for order <strong>#${orderId.slice(0, 8)}</strong> is complete and ready for pickup/delivery.</p>
        <p>Your artwork is permanently saved in your dashboard for fast one-click reordering.</p>
      </div>
    `,
  }
}
