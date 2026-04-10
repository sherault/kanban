import { redirect } from 'next/navigation'
import { getAccessToken, getUserName } from '../../../lib/session'
import { api } from '../../../lib/api'
import { ApiKeysSection } from './ApiKeysSection'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  const [displayName, { data: keys }] = await Promise.all([
    getUserName(),
    api.profile.listKeys(token),
  ])

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Profile</h1>
      <p className="text-sm text-gray-500 mb-8">{displayName}</p>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">MCP API Keys</h2>
        <p className="text-sm text-gray-500 mb-4">
          Use these keys to authenticate Claude (or other MCP clients) with your Kanban board.
          Configure your client:
        </p>
        <pre className="bg-gray-50 border border-gray-200 rounded-md px-4 py-3 text-xs font-mono text-gray-700 mb-6 overflow-x-auto">{`{
  "mcpServers": {
    "kanban": {
      "url": "${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/mcp/sse",
      "headers": { "Authorization": "Bearer <your-key>" }
    }
  }
}`}</pre>
        <ApiKeysSection initialKeys={keys} />
      </section>
    </div>
  )
}
