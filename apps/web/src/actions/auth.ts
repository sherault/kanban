'use server'

import { redirect } from 'next/navigation'
import { api, ApiError } from '../lib/api'
import {
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  extractRefreshToken,
} from '../lib/session'

export async function loginAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  let accessToken: string
  let displayName: string
  let refreshToken: string | undefined

  try {
    const { data, headers } = await api.auth.login({ email, password })
    accessToken = data.accessToken
    displayName = data.user.displayName
    refreshToken = extractRefreshToken(headers.get('set-cookie'))
    await setTokens(accessToken, displayName, refreshToken, data.user.id)
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Login failed' }
  }
  redirect('/orgs')
}

export async function registerAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const displayName = formData.get('displayName') as string

  try {
    await api.auth.register({ email, password, displayName })
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Registration failed' }
  }

  redirect('/login')
}

export async function logoutAction(): Promise<void> {
  const token = await getAccessToken()
  const refreshToken = await getRefreshToken()
  if (token && refreshToken) {
    await api.auth.logout(token, refreshToken).catch(() => {})
  }
  await clearTokens()
  redirect('/login')
}

export async function acceptInviteAction(
  rawToken: string,
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const displayName = formData.get('displayName') as string

  let accessToken: string
  let userDisplayName: string
  let refreshToken: string | undefined

  try {
    const { data, headers } = await api.invite.accept(rawToken, { email, password, displayName })
    accessToken = data.accessToken
    userDisplayName = data.user.displayName
    refreshToken = extractRefreshToken(headers.get('set-cookie'))
    await setTokens(accessToken, userDisplayName, refreshToken, data.user.id)
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to accept invitation' }
  }
  redirect('/orgs')
}
