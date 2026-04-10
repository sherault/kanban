import Link from 'next/link'
import { getUserName } from '../../lib/session'
import { logoutAction } from '../../actions/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const displayName = await getUserName()

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <Link href="/orgs" className="font-bold text-gray-900 text-lg tracking-tight">
          Kanban
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{displayName}</span>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
