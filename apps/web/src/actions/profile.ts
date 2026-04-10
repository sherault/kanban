'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { api, ApiError } from '../lib/api'
import { getAccessToken } from '../lib/session'
import type { ApiKeyCreatedDto } from '@kanban/shared'

export async function createApiKeyAction(
  _prev: { error?: string; created?: ApiKeyCreatedDto },
  formData: FormData
): Promise<{ error?: string; created?: ApiKeyCreatedDto }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  const label = (formData.get('label') as string)?.trim()
  if (!label) return { error: 'Label is required' }

  try {
    const { data: created } = await api.profile.createKey(token, label)
    revalidatePath('/profile')
    return { created }
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to create key' }
  }
}

export async function revokeApiKeyAction(keyId: string): Promise<{ error?: string }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  try {
    await api.profile.revokeKey(token, keyId)
    revalidatePath('/profile')
    return {}
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to revoke key' }
  }
}
