import { describe, it, expect, beforeAll } from 'vitest'
import { createTestDb } from '../../db/test-utils.js'
import { createApp } from '../../app.js'
import { IdentityService } from '../../features/identity/identity.service.js'

beforeAll(() => {
  process.env['JWT_SECRET'] = 'test-jwt-secret-must-be-at-least-32-chars!!'
  process.env['NODE_ENV'] = 'test'
})

async function setup() {
  const testDb = createTestDb()
  const app = createApp(testDb.db)
  const idSvc = new IdentityService(testDb.db)

  // Create a user and get their access token
  await idSvc.register({ email: 'alice@example.com', password: 'password123', displayName: 'Alice' })
  const { accessToken } = await idSvc.login({ email: 'alice@example.com', password: 'password123' })

  return { app, accessToken, close: testDb.close }
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('POST /organizations', () => {
  it('creates an org and returns 201', async () => {
    const { app, accessToken, close } = await setup()
    const res = await app.request('/organizations', {
      method: 'POST',
      headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme Corp', website: 'https://acme.com' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; name: string }
    expect(body.name).toBe('Acme Corp')
    expect(typeof body.id).toBe('string')
    close()
  })

  it('returns 401 without auth', async () => {
    const { app, close } = await setup()
    const res = await app.request('/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    })
    expect(res.status).toBe(401)
    close()
  })
})

describe('GET /organizations', () => {
  it('returns only orgs the user belongs to', async () => {
    const { app, accessToken, close } = await setup()
    // Create two orgs
    await app.request('/organizations', { method: 'POST', headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Org A' }) })
    await app.request('/organizations', { method: 'POST', headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Org B' }) })
    const res = await app.request('/organizations', { headers: authHeaders(accessToken) })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string; name: string }[]
    expect(body.length).toBe(2)
    close()
  })
})

describe('PATCH /organizations/:orgId', () => {
  it('updates the org name (owner allowed)', async () => {
    const { app, accessToken, close } = await setup()
    const createRes = await app.request('/organizations', { method: 'POST', headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Old Name' }) })
    const { id: orgId } = (await createRes.json()) as { id: string }

    const res = await app.request(`/organizations/${orgId}`, {
      method: 'PATCH',
      headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { name: string }
    expect(body.name).toBe('New Name')
    close()
  })
})

describe('DELETE /organizations/:orgId', () => {
  it('returns 422 when deleting the only org', async () => {
    const { app, accessToken, close } = await setup()
    const createRes = await app.request('/organizations', { method: 'POST', headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Solo Org' }) })
    const { id: orgId } = (await createRes.json()) as { id: string }

    const res = await app.request(`/organizations/${orgId}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    })
    expect(res.status).toBe(422)
    close()
  })

  it('deletes the org when owner has another org', async () => {
    const { app, accessToken, close } = await setup()
    const r1 = await app.request('/organizations', { method: 'POST', headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Org 1' }) })
    const r2 = await app.request('/organizations', { method: 'POST', headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Org 2' }) })
    const { id: orgId } = (await r1.json()) as { id: string }

    const res = await app.request(`/organizations/${orgId}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    })
    expect(res.status).toBe(200)
    close()
  })
})

describe('GET /organizations/:orgId/members', () => {
  it('returns members with user info', async () => {
    const { app, accessToken, close } = await setup()
    const createRes = await app.request('/organizations', { method: 'POST', headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Acme' }) })
    const { id: orgId } = (await createRes.json()) as { id: string }

    const res = await app.request(`/organizations/${orgId}/members`, {
      headers: authHeaders(accessToken),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { userId: string; role: string }[]
    expect(body.length).toBe(1)
    expect(body[0]?.role).toBe('owner')
    close()
  })
})
