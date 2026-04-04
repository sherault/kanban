import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { createTestDb } from '../../db/test-utils.js'
import { makeAuthz } from '../../middleware/authz.js'
import { authnMiddleware } from '../../middleware/authn.js'
import { signAccessToken } from '../../lib/jwt.js'
import { generateId } from '../../lib/id.js'
import { users, organizations, memberships } from '../../db/schema/index.js'
import type { HonoEnv } from '../../types.js'

beforeAll(() => {
  process.env['JWT_SECRET'] = 'test-jwt-secret-must-be-at-least-32-chars!!'
})

function seed(db: ReturnType<typeof createTestDb>['db']) {
  const userId = generateId()
  const managerId = generateId()
  const ownerId = generateId()
  const orgId = generateId()

  db.insert(users).values([
    { id: userId, email: 'member@ex.com', passwordHash: 'x', displayName: 'Member' },
    { id: managerId, email: 'manager@ex.com', passwordHash: 'x', displayName: 'Manager' },
    { id: ownerId, email: 'owner@ex.com', passwordHash: 'x', displayName: 'Owner' },
  ]).run()

  db.insert(organizations).values({ id: orgId, name: 'Acme' }).run()

  db.insert(memberships).values([
    { userId, organizationId: orgId, role: 'member' },
    { userId: managerId, organizationId: orgId, role: 'manager' },
    { userId: ownerId, organizationId: orgId, role: 'owner' },
  ]).run()

  return { userId, managerId, ownerId, orgId }
}

async function tokenFor(userId: string) {
  return signAccessToken({ sub: userId, sessionId: generateId() })
}

function makeApp(db: ReturnType<typeof createTestDb>['db'], minRole: 'member' | 'manager' | 'owner') {
  const app = new Hono<HonoEnv>()
  const authz = makeAuthz(db)
  app.use('*', authnMiddleware)
  app.get('/:orgId/resource', authz.requireOrgRole(minRole, (c) => c.req.param('orgId')), (c) =>
    c.json({ ok: true })
  )
  return app
}

describe('makeAuthz.requireOrgRole', () => {
  it('allows member to access member-level route', async () => {
    const { db, close } = createTestDb()
    const { userId, orgId } = seed(db)
    const app = makeApp(db, 'member')
    const res = await app.request(`/${orgId}/resource`, {
      headers: { Authorization: `Bearer ${await tokenFor(userId)}` },
    })
    expect(res.status).toBe(200)
    close()
  })

  it('blocks member from manager-level route', async () => {
    const { db, close } = createTestDb()
    const { userId, orgId } = seed(db)
    const app = makeApp(db, 'manager')
    const res = await app.request(`/${orgId}/resource`, {
      headers: { Authorization: `Bearer ${await tokenFor(userId)}` },
    })
    expect(res.status).toBe(403)
    close()
  })

  it('allows manager to access manager-level route', async () => {
    const { db, close } = createTestDb()
    const { managerId, orgId } = seed(db)
    const app = makeApp(db, 'manager')
    const res = await app.request(`/${orgId}/resource`, {
      headers: { Authorization: `Bearer ${await tokenFor(managerId)}` },
    })
    expect(res.status).toBe(200)
    close()
  })

  it('allows owner to access manager-level route (higher role)', async () => {
    const { db, close } = createTestDb()
    const { ownerId, orgId } = seed(db)
    const app = makeApp(db, 'manager')
    const res = await app.request(`/${orgId}/resource`, {
      headers: { Authorization: `Bearer ${await tokenFor(ownerId)}` },
    })
    expect(res.status).toBe(200)
    close()
  })

  it('blocks a user who is not a member of the org', async () => {
    const { db, close } = createTestDb()
    const { orgId } = seed(db)
    const outsiderId = generateId()
    db.insert(users).values({ id: outsiderId, email: 'out@ex.com', passwordHash: 'x', displayName: 'Out' }).run()
    const app = makeApp(db, 'member')
    const res = await app.request(`/${orgId}/resource`, {
      headers: { Authorization: `Bearer ${await tokenFor(outsiderId)}` },
    })
    expect(res.status).toBe(403)
    close()
  })
})
