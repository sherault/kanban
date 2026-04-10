import Link from 'next/link'

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params

  return (
    <div>
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/orgs" className="hover:text-gray-900 transition-colors">
          Organizations
        </Link>
        <span className="text-gray-300">/</span>
        <Link href={`/orgs/${orgId}`} className="hover:text-gray-900 transition-colors">
          Projects
        </Link>
      </nav>
      {children}
    </div>
  )
}
