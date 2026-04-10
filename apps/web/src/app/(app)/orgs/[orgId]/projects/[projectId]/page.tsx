import { redirect } from 'next/navigation'
import { api } from '../../../../../../lib/api'
import { getAccessToken } from '../../../../../../lib/session'
import { BoardClient } from './BoardClient'

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>
}) {
  const { orgId, projectId } = await params
  const token = await getAccessToken()
  if (!token) redirect('/login')

  const [{ data: tasks }, { data: members }] = await Promise.all([
    api.tasks.list(token, projectId),
    api.orgs.listMembers(token, orgId),
  ])

  return (
    <BoardClient
      initialTasks={tasks}
      orgMembers={members}
      projectId={projectId}
      orgId={orgId}
    />
  )
}
