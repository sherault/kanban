import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { setCookie } from 'hono/cookie'
import type { AppDb, HonoEnv } from '../../types.js'
import { InvitationService } from './invitation.service.js'
import { notFound } from '../../lib/errors.js'

const COOKIE_NAME = 'refresh_token'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60

const acceptSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
})

export function invitationRoutes(db: AppDb): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>()
  const svc = new InvitationService(db)

  // GET /invite/:token — public, returns org info for the invite page
  router.get('/:token', (c) => {
    const org = svc.getOrgByToken(c.req.param('token'))
    if (!org) throw notFound('Invitation not found or expired')
    return c.json({ organization: org })
  })

  // POST /invite/:token — public, register + join
  router.post('/:token', zValidator('json', acceptSchema), async (c) => {
    const body = c.req.valid('json')
    const result = await svc.acceptInvitation(c.req.param('token'), body)
    setCookie(c, COOKIE_NAME, result.refreshToken, {
      httpOnly: true,
      sameSite: 'Strict',
      secure: process.env['NODE_ENV'] === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })
    return c.json({ user: result.user, accessToken: result.accessToken }, 201)
  })

  return router
}
