import { cookies } from 'next/headers'

const ACCESS_COOKIE = 'access_token'
const REFRESH_COOKIE = 'refresh_token'
const USER_NAME_COOKIE = 'user_name'

const secure = process.env['NODE_ENV'] === 'production'

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value
}

export async function getRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value
}

export async function getUserName(): Promise<string> {
  return (await cookies()).get(USER_NAME_COOKIE)?.value ?? 'User'
}

/**
 * Store access token, display name, and optionally the refresh token.
 * The refresh token comes from the API's Set-Cookie header — see extractRefreshToken().
 */
export async function setTokens(
  accessToken: string,
  displayName: string,
  refreshToken?: string
): Promise<void> {
  const jar = await cookies()
  jar.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 15 * 60,
    path: '/',
  })
  jar.set(USER_NAME_COOKIE, displayName, {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })
  if (refreshToken) {
    jar.set(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })
  }
}

export async function clearTokens(): Promise<void> {
  const jar = await cookies()
  jar.delete(ACCESS_COOKIE)
  jar.delete(REFRESH_COOKIE)
  jar.delete(USER_NAME_COOKIE)
}

/**
 * Parse refresh_token value out of a Set-Cookie header string.
 * Example header: "refresh_token=abc123; HttpOnly; Path=/; Max-Age=604800"
 */
export function extractRefreshToken(setCookieHeader: string | null): string | undefined {
  if (!setCookieHeader) return undefined
  const match = setCookieHeader.match(/refresh_token=([^;]+)/)
  return match?.[1] ?? undefined
}
