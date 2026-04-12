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
  const { accessToken: token } = await loginTestUser(app, testDb.db, { email: 'alice@example.com', password: 'password123', displayName: 'Alice' })

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

  async function createTask(title = 'Task') {
    const res = await app.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, startDate: '2026-01-01', endDate: '2026-12-31' }),
    })
    return (await res.json()) as { id: string; tags: string[]; linkedTaskIds: string[] }
  }

  return { app, token, orgId, projectId, createTask, close: testDb.close }
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('Tags', () => {
  it('adds and removes a tag', async () => {
    const { app, token, projectId, createTask, close } = await setup()
    const task = await createTask()

    const addRes = await app.request(`/projects/${projectId}/tasks/${task.id}/tags/urgent`, {
      method: 'POST',
      headers: auth(token),
    })
    expect(addRes.status).toBe(200)
    const withTag = (await addRes.json()) as { tags: string[] }
    expect(withTag.tags).toContain('urgent')

    const rmRes = await app.request(`/projects/${projectId}/tasks/${task.id}/tags/urgent`, {
      method: 'DELETE',
      headers: auth(token),
    })
    expect(rmRes.status).toBe(200)
    const withoutTag = (await rmRes.json()) as { tags: string[] }
    expect(withoutTag.tags).not.toContain('urgent')
    close()
  })
})

describe('Links', () => {
  it('adds and removes a link between two tasks', async () => {
    const { app, token, projectId, createTask, close } = await setup()
    const t1 = await createTask('T1')
    const t2 = await createTask('T2')

    const addRes = await app.request(
      `/projects/${projectId}/tasks/${t1.id}/links/${t2.id}`,
      { method: 'POST', headers: auth(token) }
    )
    expect(addRes.status).toBe(200)
    const linked = (await addRes.json()) as { linkedTaskIds: string[] }
    expect(linked.linkedTaskIds).toContain(t2.id)

    // Also visible from t2 side
    const t2View = await app.request(`/projects/${projectId}/tasks/${t2.id}`, { headers: auth(token) })
    const t2Body = (await t2View.json()) as { linkedTaskIds: string[] }
    expect(t2Body.linkedTaskIds).toContain(t1.id)

    const rmRes = await app.request(
      `/projects/${projectId}/tasks/${t1.id}/links/${t2.id}`,
      { method: 'DELETE', headers: auth(token) }
    )
    expect(rmRes.status).toBe(200)
    const unlinked = (await rmRes.json()) as { linkedTaskIds: string[] }
    expect(unlinked.linkedTaskIds).not.toContain(t2.id)
    close()
  })
})

describe('Watchers', () => {
  it('adds a watcher and records history', async () => {
    const { app, token, projectId, createTask, close } = await setup()
    const task = await createTask()

    // Get alice's userId from task reporter
    const taskRes = await app.request(`/projects/${projectId}/tasks/${task.id}`, { headers: auth(token) })
    const { reporter } = (await taskRes.json()) as { reporter: { id: string } }

    const addRes = await app.request(
      `/projects/${projectId}/tasks/${task.id}/watchers/${reporter.id}`,
      { method: 'POST', headers: auth(token) }
    )
    expect(addRes.status).toBe(200)
    const withWatcher = (await addRes.json()) as { watchers: { id: string }[] }
    expect(withWatcher.watchers.map((w) => w.id)).toContain(reporter.id)

    const historyRes = await app.request(`/projects/${projectId}/tasks/${task.id}/history`, { headers: auth(token) })
    const history = (await historyRes.json()) as { field: string }[]
    expect(history.some((h) => h.field === 'watchers')).toBe(true)
    close()
  })
})

describe('Advisors', () => {
  it('adds an advisor and records history', async () => {
    const { app, token, projectId, createTask, close } = await setup()
    const task = await createTask()
    const taskRes = await app.request(`/projects/${projectId}/tasks/${task.id}`, { headers: auth(token) })
    const { reporter } = (await taskRes.json()) as { reporter: { id: string } }

    const addRes = await app.request(
      `/projects/${projectId}/tasks/${task.id}/advisors/${reporter.id}`,
      { method: 'POST', headers: auth(token) }
    )
    expect(addRes.status).toBe(200)
    const withAdvisor = (await addRes.json()) as { advisors: { id: string }[] }
    expect(withAdvisor.advisors.map((a) => a.id)).toContain(reporter.id)
    close()
  })
})
