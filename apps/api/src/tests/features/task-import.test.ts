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

  await idSvc.register({ email: 'alice@example.com', password: 'pass', displayName: 'Alice' })
  const loginRes = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice@example.com', password: 'pass' }),
  })
  const { accessToken: token } = (await loginRes.json()) as { accessToken: string }

  const orgRes = await app.request('/organizations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Acme' }),
  })
  const { id: orgId } = (await orgRes.json()) as { id: string }

  const projRes = await app.request(`/organizations/${orgId}/projects`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sprint 1' }),
  })
  const { id: projectId } = (await projRes.json()) as { id: string }

  return { app, token, projectId, close: testDb.close }
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function csvFile(content: string): FormData {
  const form = new FormData()
  form.append('file', new Blob([content], { type: 'text/csv' }), 'import.csv')
  return form
}

const validCsv = `title,description,startDate,endDate,column
Fix login bug,,2026-01-01,2026-12-31,todo
Add dark mode,Make it dark,2026-02-01,2026-06-30,ideas
`

describe('POST /projects/:projectId/import', () => {
  it('imports valid CSV rows and returns count', async () => {
    const { app, token, projectId, close } = await setup()
    const res = await app.request(`/projects/${projectId}/import`, {
      method: 'POST',
      headers: auth(token),
      body: csvFile(validCsv),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { imported: number; skipped: number }
    expect(body.imported).toBe(2)
    expect(body.skipped).toBe(0)

    // Verify tasks exist
    const listRes = await app.request(`/projects/${projectId}/tasks`, { headers: auth(token) })
    const tasks = (await listRes.json()) as { title: string }[]
    expect(tasks.length).toBe(2)
    expect(tasks.map((t) => t.title)).toContain('Fix login bug')
    close()
  })

  it('skips rows missing required fields', async () => {
    const { app, token, projectId, close } = await setup()
    const csv = `title,description,startDate,endDate,column
,missing title,2026-01-01,2026-12-31,todo
Valid task,,2026-01-01,2026-12-31,todo
Another,,2026-01-01,,todo
`
    const res = await app.request(`/projects/${projectId}/import`, {
      method: 'POST',
      headers: auth(token),
      body: csvFile(csv),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { imported: number; skipped: number }
    expect(body.imported).toBe(1)
    expect(body.skipped).toBe(2)
    close()
  })

  it('defaults invalid column to todo', async () => {
    const { app, token, projectId, close } = await setup()
    const csv = `title,startDate,endDate,column\nTask,2026-01-01,2026-12-31,invalid_column\n`
    const res = await app.request(`/projects/${projectId}/import`, {
      method: 'POST',
      headers: auth(token),
      body: csvFile(csv),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { imported: number }
    expect(body.imported).toBe(1)

    const listRes = await app.request(`/projects/${projectId}/tasks`, { headers: auth(token) })
    const tasks = (await listRes.json()) as { column: string }[]
    expect(tasks[0]?.column).toBe('todo')
    close()
  })

  it('returns 422 when file field is missing', async () => {
    const { app, token, projectId, close } = await setup()
    const res = await app.request(`/projects/${projectId}/import`, {
      method: 'POST',
      headers: auth(token),
      body: new FormData(), // empty form
    })
    expect(res.status).toBe(422)
    close()
  })
})
