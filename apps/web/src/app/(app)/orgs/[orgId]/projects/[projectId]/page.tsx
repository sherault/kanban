import Link from 'next/link'

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>
}) {
  const { orgId } = await params

  return (
    <div className="text-center py-24">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
        <svg
          className="w-8 h-8 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Board coming soon</h2>
      <p className="text-gray-500 text-sm mb-6">
        The Kanban board will be built in the next plan.
      </p>
      <Link href={`/orgs/${orgId}`} className="text-sm text-blue-600 hover:underline">
        ← Back to projects
      </Link>
    </div>
  )
}
