import Link from 'next/link'
import { redirect } from 'next/navigation'
import { api } from '../../../lib/api'
import { getAccessToken } from '../../../lib/session'

export default async function OrgsPage() {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  const { data: orgs } = await api.orgs.list(token)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
        <Link
          href="/orgs/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          New organization
        </Link>
      </div>

      {orgs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">No organizations yet</p>
          <p className="text-sm">Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/orgs/${org.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-sm transition-all"
            >
              <div className="font-medium text-gray-900">{org.name}</div>
              {org.website && (
                <div className="text-sm text-gray-400 mt-0.5">{org.website}</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
