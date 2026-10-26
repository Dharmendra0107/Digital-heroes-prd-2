import { cookies } from 'next/headers'
import {
  DEMO_SESSION_COOKIE,
  isDemoAuthEnabled,
  verifyDemoSession,
} from '@/lib/demo-auth'

export async function getDemoSession() {
  if (!isDemoAuthEnabled()) return null

  const secret = process.env.DEMO_AUTH_SECRET
  if (!secret) {
    throw new Error('DEMO_AUTH_SECRET is required when local demo auth is enabled')
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(DEMO_SESSION_COOKIE)?.value

  return token ? verifyDemoSession(token, secret) : null
}
