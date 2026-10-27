import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { DEMO_ACCOUNTS } from '@/lib/demo-auth-credentials'
import { isDemoAuthEnabled } from '@/lib/demo-auth'
import type { Profile } from '@/types'
import AdminUserEditor from './AdminUserEditor'

export default async function AdminUsersPage() {
  let profiles: Profile[] = isDemoAuthEnabled()
    ? Object.values(DEMO_ACCOUNTS).map((account) => ({
        id: account.userId,
        email: account.email,
        full_name: account.name,
        role: account.role,
        company: account.company,
        created_at: new Date().toISOString(),
      }))
    : []

  if (!isDemoAuthEnabled()) {
    const adminClient = createSupabaseAdminClient()
    try {
      const { data } = await adminClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) {
        profiles = data as Profile[]
      }
    } catch (err) {
      console.warn('[AdminUsersPage] error:', err)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Registered Users &amp; Roles</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Role-based permissions (Customer vs Administrator).
        </p>
        {isDemoAuthEnabled() && (
          <p className="mt-2 text-xs text-amber-300">
            Demo accounts are read-only. Connect Supabase to edit saved user profiles.
          </p>
        )}
      </div>

      <div className="bg-neutral-800/40 rounded-2xl border border-neutral-700/60 overflow-hidden shadow-sm">
        {profiles.length === 0 ? (
          <div className="p-12 text-center text-neutral-400 text-xs">
            No registered profiles found in the database yet. Users appear as they sign up.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-neutral-900/60 border-b border-neutral-700 text-neutral-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-3 px-6">User / Full Name</th>
                  <th className="py-3 px-6">Email Address</th>
                  <th className="py-3 px-6">Platform Role</th>
                  <th className="py-3 px-6">Joined On</th>
                  {!isDemoAuthEnabled() && <th className="py-3 px-6">Edit</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {profiles.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-white">{user.full_name || 'N/A'}</td>
                    <td className="py-4 px-6 font-mono text-neutral-300">{user.email}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          user.role === 'admin'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-neutral-700 text-neutral-300'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-neutral-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    {!isDemoAuthEnabled() && (
                      <td className="py-4 px-6">
                        <AdminUserEditor
                          id={user.id}
                          fullName={user.full_name || ''}
                          company={user.company || ''}
                          role={user.role}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
