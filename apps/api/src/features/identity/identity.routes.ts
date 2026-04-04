import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import type { AppDb, HonoEnv } from '../../types.js'
import { IdentityService } from './identity.service.js'

const COOKIE_NAME = 'refresh_token'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days in seconds

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export function identityRoutes(db: AppDb): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>()
  const svc = new IdentityService(db)

  router.post('/register', zValidator('json', registerSchema), async (c) => {
    const body = c.req.valid('json')
    const user = await svc.register(body)
    return c.json({ user }, 201)
  })

  router.post('/login', zValidator('json', loginSchema), async (c) => {
    const body = c.req.valid('json')
    const result = await svc.login(body)
    setCookie(c, COOKIE_NAME, result.refreshToken, {
      httpOnly: true,
      sameSite: 'Strict',
      secure: process.env['NODE_ENV'] === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })
    return c.json({ user: result.user, accessToken: result.accessToken })
  })

  router.post('/refresh', async (c) => {
    const rawToken = getCookie(c, COOKIE_NAME)
    if (!rawToken) return c.json({ error: 'No refresh token' }, 401)
    const result = await svc.refresh(rawToken)
    setCookie(c, COOKIE_NAME, result.newRefreshToken, {
      httpOnly: true,
      sameSite: 'Strict',
      secure: process.env['NODE_ENV'] === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })
    return c.json({ accessToken: result.accessToken })
  })

  router.post('/logout', async (c) => {
    const rawToken = getCookie(c, COOKIE_NAME)
    if (rawToken) await svc.logout(rawToken)
    deleteCookie(c, COOKIE_NAME, { path: '/' })
    return c.json({ success: true })
  })

  return router
}
