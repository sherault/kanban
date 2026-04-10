'use server'

import { redirect } from 'next/navigation'
import { api, ApiError } from '../lib/api'
import { getAccessToken } from '../lib/session'

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
