import { SignJWT, jwtVerify } from 'jose'

export interface AccessTokenPayload {
  sub: string
  sessionId: string
  iat?: number
  exp?: number
}

function getSecret(): Uint8Array {
  const secret = process.env['JWT_SECRET']
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export async function signAccessToken(
  payload: Pick<AccessTokenPayload, 'sub' | 'sessionId'>
): Promise<string> {
  return new SignJWT({ sessionId: payload.sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getSecret())
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return {
    sub: payload.sub as string,
    sessionId: payload['sessionId'] as string,
    iat: payload.iat,
    exp: payload.exp,
  }
}
