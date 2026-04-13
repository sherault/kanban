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
  _prev: { error?: string; totpRequired?: boolean; email?: string; password?: string },
  formData: FormData
): Promise<{ error?: string; totpRequired?: boolean; email?: string; password?: string }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const totpCode = (formData.get('totpCode') as string | null) ?? undefined

  try {
    const { data, headers } = await api.auth.login({ email, password, totpCode })

    if ('totpRequired' in data) {
      return { totpRequired: true, email, password }
    }

    const accessToken = data.accessToken
    const displayName = data.user.displayName
    const refreshToken = extractRefreshToken(headers.get('set-cookie'))
    await setTokens(accessToken, displayName, refreshToken, data.user.id)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const msg = e.message
      // Pass back email/password so the TOTP step can re-submit them
      if (totpCode) return { error: msg, totpRequired: true, email, password }
      return { error: msg }
    }
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

  redirect('/register/check-email')
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

export async function forgotPasswordAction(
  _prev: Record<string, never>,
  formData: FormData
): Promise<Record<string, never>> {
  const email = formData.get('email') as string
  await api.auth.forgotPassword({ email }).catch(() => {})
  redirect('/forgot-password/check-email')
}

export async function resetPasswordAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const token = formData.get('token') as string
  const password = formData.get('password') as string
  try {
    await api.auth.resetPassword({ token, password })
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Reset failed' }
  }
  redirect('/login?reset=success')
}

export async function resendVerificationPublicAction(
  _prev: Record<string, never>,
  formData: FormData
): Promise<Record<string, never>> {
  const email = formData.get('email') as string
  await api.auth.resendVerificationPublic({ email }).catch(() => {})
  redirect('/register/check-email')
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
