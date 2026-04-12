import Link from 'next/link'
import { redirect } from 'next/navigation'
import { api } from '../../../../../../lib/api'
import { getAccessToken } from '../../../../../../lib/session'

export default async function BoardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgId: string; projectId: string }>
}) {
  const { orgId, projectId } = await params
  const token = await getAccessToken()
  if (!token) redirect('/login')

  const { data: projects } = await api.projects.list(token, orgId)

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col overflow-y-auto shrink-0">
        <div className="px-4 py-3 border-b border-gray-100">
          <Link
            href="/orgs"
            className="text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600 transition-colors"
          >
            ← Organizations
          </Link>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {projects.map((p) => (
            <div key={p.id} className="group flex items-center gap-1">
              <Link
                href={`/orgs/${orgId}/projects/${p.id}`}
                className={`flex-1 flex items-center px-3 py-2 rounded-md text-sm transition-colors truncate ${
                  p.id === projectId
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p.name}
              </Link>
              <Link
                href={`/orgs/${orgId}/projects/${p.id}/settings`}
                className="shrink-0 px-1 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all text-sm"
                title="Settings"
              >
                ⚙️
              </Link>
            </div>
          ))}
        </nav>

        <div className="p-2 border-t border-gray-100 space-y-0.5">
          <Link
            href={`/orgs/${orgId}/projects/new`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <span>+</span> New project
          </Link>
          <Link
            href={`/orgs/${orgId}/settings`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Settings
          </Link>
        </div>
      </aside>

      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
