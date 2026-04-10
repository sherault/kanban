import Link from 'next/link'
import { redirect } from 'next/navigation'
import { api } from '../../../../lib/api'
import { getAccessToken } from '../../../../lib/session'

export default async function OrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const token = await getAccessToken()
  if (!token) redirect('/login')

  const { data: projects } = await api.projects.list(token, orgId)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Projects</h2>
        <div className="flex items-center gap-3">
          <Link
            href={`/orgs/${orgId}/settings`}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Settings
          </Link>
          <Link
            href={`/orgs/${orgId}/projects/new`}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            New project
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">No projects yet</p>
          <p className="text-sm">Create a project to start organizing your work.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/orgs/${orgId}/projects/${p.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-sm transition-all"
            >
              <div className="font-medium text-gray-900">{p.name}</div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(p.createdAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
