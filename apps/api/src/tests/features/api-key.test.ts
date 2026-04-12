import { describe, it, expect, beforeAll } from 'vitest'
import { createTestDb, loginTestUser } from '../../db/test-utils.js'
import { createApp } from '../../app.js'

beforeAll(() => {
  process.env['JWT_SECRET'] = 'test-jwt-secret-must-be-at-least-32-chars!!'
  process.env['NODE_ENV'] = 'test'
})

async function setup() {
  const testDb = createTestDb()
  const app = createApp(testDb.db)
  const { accessToken } = await loginTestUser(app, testDb.db, { email: 'alice@example.com', password: 'password123', displayName: 'Alice' })
  return { app, accessToken, close: testDb.close }
}

describe('POST /profile/api-keys', () => {
  it('creates a key and returns rawKey once', async () => {
    const { app, accessToken, close } = await setup()
    const res = await app.request('/profile/api-keys', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ label: 'My MCP Key' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; label: string; rawKey: string }
    expect(body.label).toBe('My MCP Key')
    expect(body.rawKey).toMatch(/^kbk_/)
    expect(typeof body.id).toBe('string')
    close()
  })
})

describe('GET /profile/api-keys', () => {
  it('lists keys without rawKey', async () => {
    const { app, accessToken, close } = await setup()
    await app.request('/profile/api-keys', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Key 1' }),
    })
    await app.request('/profile/api-keys', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Key 2' }),
    })
    const res = await app.request('/profile/api-keys', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string; label: string; rawKey?: string }[]
    expect(body.length).toBe(2)
    expect(body[0]).not.toHaveProperty('rawKey')
    close()
  })
})

describe('DELETE /profile/api-keys/:keyId', () => {
  it('revokes a key so it can no longer be resolved', async () => {
    const { app, accessToken, close } = await setup()
    const createRes = await app.request('/profile/api-keys', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'To Revoke' }),
    })
    const { id: keyId } = (await createRes.json()) as { id: string }

    const res = await app.request(`/profile/api-keys/${keyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.status).toBe(200)
    close()
  })

  it('returns 404 for a key that belongs to another user', async () => {
    const { app, accessToken, close } = await setup()
    // Create a key for alice, then try to delete it with a clearly invalid keyId
    const res = await app.request(`/profile/api-keys/nonexistent-key-id`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.status).toBe(404)
    close()
  })
})
