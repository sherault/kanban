import { NextResponse } from 'next/server'
import { getAccessToken } from '../../../../lib/session'
import { api } from '../../../../lib/api'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  const { projectId } = await params
  const token = await getAccessToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(_req.url)
  const search = url.searchParams.get('search') ?? undefined
  const page = parseInt(url.searchParams.get('page') ?? '1', 10)

  try {
    const { data } = await api.tasks.listArchived(token, projectId, search, page)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
