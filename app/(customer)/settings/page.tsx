import { getAppSession } from '@/lib/app-session'
import ProfileSettingsForm from './ProfileSettingsForm'

export default async function ProfileSettingsPage() {
  const session = await getAppSession()
  if (!session) return null

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Account settings</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Update the name and company shown on your account and orders.
        </p>
      </div>
      <div className="max-w-2xl rounded-xl border border-neutral-200 bg-neutral-100 p-4 text-xs text-neutral-600">
        Email address: <span className="font-medium text-neutral-900">{session.email}</span>
        <span className="ml-1">— contact support if it needs to change.</span>
      </div>
      <ProfileSettingsForm fullName={session.name} company={session.company} />
    </div>
  )
}
