import { describe, it, expect, beforeAll } from 'vitest'
import { createTestDb } from '../../db/test-utils.js'
import { createApp } from '../../app.js'
import { IdentityService } from '../../features/identity/identity.service.js'
import { OrganizationService } from '../../features/organization/organization.service.js'

beforeAll(() => {
  process.env['JWT_SECRET'] = 'test-jwt-secret-must-be-at-least-32-chars!!'
  process.env['NODE_ENV'] = 'test'
})

async function setup() {
  const testDb = createTestDb()
  const app = createApp(testDb.db)
  const idSvc = new IdentityService(testDb.db)
  const orgSvc = new OrganizationService(testDb.db)

  await idSvc.register({ email: 'alice@example.com', password: 'password123', displayName: 'Alice' })
  const { accessToken } = await idSvc.login({ email: 'alice@example.com', password: 'password123' })

  // Create org as Alice via API
  const aliceOrgRes = await app.request('/organizations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alice Org' }),
  })
  const aliceOrg = (await aliceOrgRes.json()) as { id: string }

  return { app, accessToken, orgId: aliceOrg.id, close: testDb.close }
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('POST /organizations/:orgId/projects', () => {
  it('creates a project and returns 201', async () => {
    const { app, accessToken, orgId, close } = await setup()
    const res = await app.request(`/organizations/${orgId}/projects`, {
      method: 'POST',
      headers: { ...auth(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sprint 1' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; name: string; organizationId: string }
    expect(body.name).toBe('Sprint 1')
    expect(body.organizationId).toBe(orgId)
    close()
  })

  it('returns 401 without auth', async () => {
    const { app, orgId, close } = await setup()
    const res = await app.request(`/organizations/${orgId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sprint 1' }),
    })
    expect(res.status).toBe(401)
    close()
  })
})

describe('GET /organizations/:orgId/projects', () => {
  it('returns list of projects for the org', async () => {
    const { app, accessToken, orgId, close } = await setup()
    await app.request(`/organizations/${orgId}/projects`, {
      method: 'POST',
      headers: { ...auth(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'P1' }),
    })
    await app.request(`/organizations/${orgId}/projects`, {
      method: 'POST',
      headers: { ...auth(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'P2' }),
    })
    const res = await app.request(`/organizations/${orgId}/projects`, {
      headers: auth(accessToken),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string }[]
    expect(body.length).toBe(2)
    close()
  })
})

describe('PATCH /organizations/:orgId/projects/:projectId', () => {
  it('updates the project name', async () => {
    const { app, accessToken, orgId, close } = await setup()
    const cr = await app.request(`/organizations/${orgId}/projects`, {
      method: 'POST',
      headers: { ...auth(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Old Name' }),
    })
    const { id: projectId } = (await cr.json()) as { id: string }
    const res = await app.request(`/organizations/${orgId}/projects/${projectId}`, {
      method: 'PATCH',
      headers: { ...auth(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { name: string }
    expect(body.name).toBe('New Name')
    close()
  })
})

describe('Authorization', () => {
  it('returns 403 when accessing another org as non-member', async () => {
    const { app, orgId, close } = await setup()

    // Register a second user who is not a member of orgId
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@example.com', password: 'password123', displayName: 'Bob' }),
    })
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@example.com', password: 'password123' }),
    })
    const { accessToken: bobToken } = (await loginRes.json()) as { accessToken: string }

    const res = await app.request(`/organizations/${orgId}/projects`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    })
    expect(res.status).toBe(403)
    close()
  })
})

describe('DELETE /organizations/:orgId/projects/:projectId', () => {
  it('deletes the project', async () => {
    const { app, accessToken, orgId, close } = await setup()
    const cr = await app.request(`/organizations/${orgId}/projects`, {
      method: 'POST',
      headers: { ...auth(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Temp' }),
    })
    const { id: projectId } = (await cr.json()) as { id: string }
    const res = await app.request(`/organizations/${orgId}/projects/${projectId}`, {
      method: 'DELETE',
      headers: auth(accessToken),
    })
    expect(res.status).toBe(200)
    // Verify it's gone
    const getRes = await app.request(`/organizations/${orgId}/projects/${projectId}`, {
      headers: auth(accessToken),
    })
    expect(getRes.status).toBe(404)
    close()
  })
})
