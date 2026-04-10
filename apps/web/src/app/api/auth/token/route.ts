import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/session'

/**
 * GET /api/auth/token
 *
 * Returns the current access token so client-side code (WS hook) can
 * authenticate without having direct access to the httpOnly cookie.
 *
 * This endpoint is same-origin only — no CORS headers intentionally.
 */
export async function GET(): Promise<NextResponse> {
  const token = await getAccessToken()
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ token })
}
