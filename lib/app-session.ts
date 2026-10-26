import type { UserRole } from '@/types'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import { getDemoSession } from '@/lib/demo-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface AppSession {
  userId: string
  email: string
  name: string
  company: string
  role: UserRole
}

export async function getAppSession(): Promise<AppSession | null> {
  if (isDemoAuthEnabled()) {
    const demoSession = await getDemoSession()
    if (!demoSession) return null

    return {
      userId: demoSession.userId,
      email: demoSession.email,
      name: demoSession.name,
      company: demoSession.company,
      role: demoSession.role,
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, company')
    .eq('id', user.id)
    .single()

  return {
    userId: user.id,
    email: user.email ?? '',
    name: profile?.full_name || user.email?.split('@')[0] || '',
    company: profile?.company || '',
    role: profile?.role === 'admin' ? 'admin' : 'customer',
  }
}
