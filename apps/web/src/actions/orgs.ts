'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { api, ApiError } from '../lib/api'
import { getAccessToken } from '../lib/session'

export async function updateMemberRoleAction(
  orgId: string,
  userId: string,
  role: 'member' | 'manager'
): Promise<{ error?: string }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')
  try {
    await api.orgs.updateMemberRole(token, orgId, userId, role)
    revalidatePath(`/orgs/${orgId}/settings`)
    return {}
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to update role' }
  }
}

export async function removeMemberAction(
  orgId: string,
  userId: string
): Promise<{ error?: string }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')
  try {
    await api.orgs.removeMember(token, orgId, userId)
    revalidatePath(`/orgs/${orgId}/settings`)
    return {}
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to remove member' }
  }
}

export async function createOrgAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  const name = formData.get('name') as string

  let orgId: string
  try {
    const { data } = await api.orgs.create(token, { name })
    orgId = data.id
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to create organization' }
  }

  redirect(`/orgs/${orgId}`)
}
