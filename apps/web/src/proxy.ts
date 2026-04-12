import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const API_URL = process.env['API_URL'] ?? 'http://localhost:3010'
const secure = process.env['NODE_ENV'] === 'production'

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value
  if (accessToken) return NextResponse.next()

  // No access token — try to refresh silently
  const refreshToken = request.cookies.get('refresh_token')?.value
  if (refreshToken) {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: `refresh_token=${refreshToken}` },
      })
      if (res.ok) {
        const { accessToken: newToken } = (await res.json()) as { accessToken: string }
        const response = NextResponse.next()
        response.cookies.set('access_token', newToken, {
          httpOnly: true,
          sameSite: 'lax',
          secure,
          maxAge: 15 * 60,
          path: '/',
        })
        return response
      }
    } catch {
      // refresh request failed — fall through to redirect
    }
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('from', request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/orgs/:path*', '/profile/:path*'],
}
