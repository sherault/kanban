import Link from 'next/link'
import { redirect } from 'next/navigation'
import { api } from '../../../../../lib/api'
import { getAccessToken } from '../../../../../lib/session'
import { InviteSection } from './InviteSection'

export default async function OrgSettingsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const token = await getAccessToken()
  if (!token) redirect('/login')

  const { data: members } = await api.orgs.listMembers(token, orgId)

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
        <Link
          href={`/orgs/${orgId}`}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Projects
        </Link>
      </div>

      {/* Members */}
      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Members
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-900">{m.user.displayName}</div>
                <div className="text-xs text-gray-400">{m.user.email}</div>
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Invite */}
      <InviteSection orgId={orgId} />
    </div>
  )
}
