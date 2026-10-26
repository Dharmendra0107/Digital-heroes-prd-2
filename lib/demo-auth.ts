import type { UserRole } from '@/types'

export const DEMO_SESSION_COOKIE = 'dh_demo_session'

export interface DemoSession {
  userId: string
  email: string
  name: string
  company: string
  role: UserRole
  expiresAt: number
}

export function isDemoAuthEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.DEMO_AUTH === 'true'
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function importSigningKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export async function signDemoSession(session: DemoSession, secret: string) {
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(session)))
  const key = await importSigningKey(secret)
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  )

  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`
}

export async function verifyDemoSession(token: string, secret: string): Promise<DemoSession | null> {
  try {
    const [payload, encodedSignature, extra] = token.split('.')
    if (!payload || !encodedSignature || extra) return null

    const key = await importSigningKey(secret)
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(payload)
    )
    if (!valid) return null

    const session = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(payload))
    ) as Partial<DemoSession>

    if (
      typeof session.userId !== 'string' ||
      typeof session.email !== 'string' ||
      typeof session.name !== 'string' ||
      typeof session.company !== 'string' ||
      (session.role !== 'customer' && session.role !== 'admin') ||
      typeof session.expiresAt !== 'number' ||
      session.expiresAt <= Date.now()
    ) {
      return null
    }

    return session as DemoSession
  } catch {
    return null
  }
}
