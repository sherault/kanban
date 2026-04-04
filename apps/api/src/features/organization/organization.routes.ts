import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppDb, HonoEnv } from '../../types.js'
import { authnMiddleware } from '../../middleware/authn.js'
import { makeAuthz } from '../../middleware/authz.js'
import { OrganizationService } from './organization.service.js'
import { notFound } from '../../lib/errors.js'

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  website: z.string().url().nullable().optional(),
})

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  website: z.string().url().nullable().optional(),
})

const transferSchema = z.object({
  toUserId: z.string().uuid(),
})

export function organizationRoutes(db: AppDb): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>()
  const svc = new OrganizationService(db)
  const authz = makeAuthz(db)

  // All org routes require authentication
  router.use('*', authnMiddleware)

  router.get('/', (c) => c.json(svc.listOrgs(c.get('userId'))))

  router.post('/', zValidator('json', createOrgSchema), (c) => {
    const body = c.req.valid('json')
    const org = svc.createOrg(c.get('userId'), body)
    return c.json(org, 201)
  })

  router.get(
    '/:orgId',
    authz.requireOrgRole('member', (c) => c.req.param('orgId')),
    (c) => {
      const org = svc.getOrg(c.req.param('orgId'))
      if (!org) throw notFound()
      return c.json(org)
    }
  )

  router.patch(
    '/:orgId',
    authz.requireOrgRole('manager', (c) => c.req.param('orgId')),
    zValidator('json', updateOrgSchema),
    (c) => {
      const org = svc.updateOrg(c.req.param('orgId'), c.req.valid('json'))
      return c.json(org)
    }
  )

  router.delete(
    '/:orgId',
    (c) => {
      svc.deleteOrg(c.get('userId'), c.req.param('orgId'))
      return c.json({ success: true })
    }
  )

  router.get(
    '/:orgId/members',
    authz.requireOrgRole('member', (c) => c.req.param('orgId')),
    (c) => c.json(svc.listMembers(c.req.param('orgId')))
  )

  router.delete(
    '/:orgId/members/:userId',
    authz.requireOrgRole('manager', (c) => c.req.param('orgId')),
    (c) => {
      svc.removeMember(c.req.param('orgId'), c.req.param('userId'))
      return c.json({ success: true })
    }
  )

  router.post(
    '/:orgId/transfer',
    authz.requireOrgRole('owner', (c) => c.req.param('orgId')),
    zValidator('json', transferSchema),
    (c) => {
      const { toUserId } = c.req.valid('json')
      svc.transferOwnership(c.req.param('orgId'), c.get('userId'), toUserId)
      return c.json({ success: true })
    }
  )

  return router
}
