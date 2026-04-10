'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { api, ApiError } from '../lib/api'
import { getAccessToken } from '../lib/session'

export async function createInvitationAction(
  orgId: string,
  _prev: { error?: string; rawToken?: string },
  _formData: FormData
): Promise<{ error?: string; rawToken?: string }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  try {
    const { data } = await api.orgs.createInvitation(token, orgId)
    revalidatePath(`/orgs/${orgId}/settings`)
    return { rawToken: data.rawToken }
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to create invitation' }
  }
}
