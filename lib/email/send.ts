import { Resend } from 'resend'
import nodemailer from 'nodemailer'

export type EmailDelivery =
  | { status: 'sent' }
  | { status: 'skipped'; reason: 'missing_provider_configuration' }
  | { status: 'failed'; message: string }

async function sendWithSmtp(
  to: string,
  subject: string,
  html: string
): Promise<EmailDelivery> {
  const smtpSettings = {
    host: process.env.SMTP_HOST?.trim(),
    port: process.env.SMTP_PORT?.trim(),
    user: process.env.SMTP_USER?.trim(),
    pass: process.env.SMTP_PASS?.trim(),
  }
  const missingSettings = Object.entries(smtpSettings)
    .filter(([, value]) => !value)
    .map(([name]) => `SMTP_${name.toUpperCase()}`)

  if (missingSettings.length) {
    const message = `Incomplete SMTP configuration. Missing: ${missingSettings.join(', ')}`
    console.error(`[Email] ${message}`)
    return { status: 'failed', message }
  }

  const port = Number(smtpSettings.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const message = 'SMTP_PORT must be a valid port number'
    console.error(`[Email] ${message}`)
    return { status: 'failed', message }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port,
      secure: port === 465,
      auth: {
        user: smtpSettings.user,
        pass: smtpSettings.pass,
      },
    })
    await transporter.sendMail({
      from: process.env.EMAIL_FROM?.trim() || smtpSettings.user,
      to,
      subject,
      html,
    })
    return { status: 'sent' }
  } catch (error) {
    console.error('[Email] SMTP delivery failed:', error)
    return {
      status: 'failed',
      message: 'SMTP delivery failed. Check the server logs and SMTP settings.',
    }
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<EmailDelivery> {
  const smtpVariables = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'] as const
  const smtpRequested = smtpVariables.some((name) => Boolean(process.env[name]?.trim()))
  if (smtpRequested) return sendWithSmtp(to, subject, html)

  if (!process.env.RESEND_API_KEY) {
    return { status: 'skipped', reason: 'missing_provider_configuration' }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@digitalheroes.co.in',
      to,
      subject,
      html,
    })
    if (error) {
      console.error('[Email] Resend rejected the message:', error)
      return { status: 'failed', message: error.message }
    }
    return { status: 'sent' }
  } catch (error) {
    console.error('[Email] Delivery failed:', error)
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Email delivery failed',
    }
  }
}
