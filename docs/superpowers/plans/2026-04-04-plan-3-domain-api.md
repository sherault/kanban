# Domain API (Plan 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement projects, tasks (with history, relations, move, reorder), WebSockets, and CSV import in the API.

**Architecture:** Project routes mount under `/organizations/:orgId/projects` using the existing `requireOrgRole` middleware. Task routes mount under `/projects/:projectId/tasks` using a new `requireProjectMember` middleware that resolves `orgId` from the project row and sets it in the Hono context. Services accept a `Broadcaster` defaulting to a noop so all existing tests pass unchanged. The real `WsRooms` broadcaster is created in `index.ts` and injected after `createApp` returns. `@hono/node-ws` is wired the same way — `index.ts` calls `createNodeWebSocket({ app })` on the live app instance and passes `upgradeWebSocket` into the WS route.

**Tech Stack:** Hono 4.x, Drizzle ORM 0.32 (better-sqlite3 sync), @hono/node-ws, csv-parse, Zod, Vitest

---

## File Map

| Status | File | Purpose |
|--------|------|---------|
| Modify | `apps/api/src/types.ts` | Add `Broadcaster`, `WsEvent`, `noopBroadcaster`, `orgId` to HonoEnv |
| Create | `apps/api/src/features/ws/ws-rooms.ts` | WsRooms class + `noopBroadcaster` |
| Create | `apps/api/src/features/ws/ws.routes.ts` | WS upgrade route |
| Create | `apps/api/src/middleware/project-member.ts` | `requireProjectMember` middleware factory |
| Create | `apps/api/src/features/project/project.service.ts` | ProjectService (CRUD + broadcast) |
| Create | `apps/api/src/features/project/project.routes.ts` | Project CRUD routes |
| Create | `apps/api/src/features/task/task.service.ts` | TaskService (CRUD, history, relations, move, reorder, import) |
| Create | `apps/api/src/features/task/task.routes.ts` | Task CRUD + relation + move + import routes |
| Modify | `apps/api/src/app.ts` | Add `broadcast` param, mount project + task routes |
| Modify | `apps/api/src/index.ts` | Wire WsRooms + @hono/node-ws |
| Create | `apps/api/src/tests/features/ws-rooms.test.ts` | WsRooms unit tests |
| Create | `apps/api/src/tests/features/project.test.ts` | Project HTTP integration tests |
| Create | `apps/api/src/tests/features/task.test.ts` | Task HTTP integration tests |
| Create | `apps/api/src/tests/features/task-relations.test.ts` | Tag/link/watcher/advisor tests |
| Create | `apps/api/src/tests/features/task-move.test.ts` | Move + reorder tests |
| Create | `apps/api/src/tests/features/task-import.test.ts` | CSV import tests |

---

## Drizzle Patterns (must follow throughout)

- **Insert returning one row:** `.returning().get()` — never array destructuring
- **Non-returning writes:** `.run()`
- **Update with SQL datetime:** `.set({ ..., updatedAt: sql\`(datetime('now'))\` })`
- **Max aggregate:** `import { max } from 'drizzle-orm'`
- **Logical OR:** `import { or } from 'drizzle-orm'`
- **Transaction:** `db.transaction((tx) => { ... return result })` — synchronous callback

---

## Task 1: Install Dependencies + Update Types

**Files:**
- Modify: `apps/api/package.json` (via pnpm)
- Modify: `apps/api/src/types.ts`

- [ ] **Step 1: Install new packages**

```bash
cd apps/api && pnpm add @hono/node-ws csv-parse
```

- [ ] **Step 2: Run baseline tests to confirm nothing broke**

```bash
cd apps/api && pnpm test
```

Expected: all existing tests pass.

- [ ] **Step 3: Update `apps/api/src/types.ts`**

Replace the entire file with:

```typescript
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type * as schema from './db/schema/index.js'
import type { ProjectDto, TaskDto } from '@kanban/shared'

/** The concrete Drizzle DB type for this project. */
export type AppDb = BetterSQLite3Database<typeof schema>

/** Hono context environment — Variables are injected by middleware. */
export type HonoEnv = {
  Variables: {
    userId: string
    sessionId: string
    orgId: string
  }
}

/** Discriminated union of all WebSocket events broadcast to clients. */
export type WsEvent =
  | { type: 'project.created'; payload: ProjectDto }
  | { type: 'project.updated'; payload: ProjectDto }
  | { type: 'project.deleted'; payload: { id: string } }
  | { type: 'task.created'; payload: TaskDto }
  | { type: 'task.updated'; payload: TaskDto }
  | { type: 'task.deleted'; payload: { id: string; projectId: string } }

/** Function that broadcasts a WsEvent to all subscribers of a room. */
export type Broadcaster = (room: string, event: WsEvent) => void

/** No-op broadcaster — used as default in tests and factory defaults. */
export const noopBroadcaster: Broadcaster = () => {}
```

- [ ] **Step 4: Run tests again — `orgId` added to HonoEnv is backwards-compatible**

```bash
cd apps/api && pnpm test
```

Expected: all tests still pass (orgId is optional access, no existing handler calls `c.get('orgId')`).

- [ ] **Step 5: Commit**

```bash
cd apps/api && git add src/types.ts package.json ../../pnpm-lock.yaml
git commit -m "feat: install node-ws + csv-parse, add Broadcaster and WsEvent types"
```

---

## Task 2: WsRooms Class

**Files:**
- Create: `apps/api/src/features/ws/ws-rooms.ts`
- Create: `apps/api/src/tests/features/ws-rooms.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/tests/features/ws-rooms.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { WsRooms } from '../../features/ws/ws-rooms.js'
import type { WSContext } from 'hono/ws'

function makeFakeWs(id: string) {
  return { send: vi.fn(), close: vi.fn(), _id: id } as unknown as WSContext
}

describe('WsRooms', () => {
  it('broadcasts to subscribers of a room', () => {
    const rooms = new WsRooms()
    const ws = makeFakeWs('a')
    rooms.subscribe('project:1', ws)
    rooms.broadcast('project:1', { type: 'task.deleted', payload: { id: 'x', projectId: '1' } })
    expect(ws.send).toHaveBeenCalledOnce()
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'task.deleted', payload: { id: 'x', projectId: '1' } }))
  })

  it('does not broadcast to subscribers of a different room', () => {
    const rooms = new WsRooms()
    const ws = makeFakeWs('a')
    rooms.subscribe('project:1', ws)
    rooms.broadcast('project:2', { type: 'task.deleted', payload: { id: 'x', projectId: '2' } })
    expect(ws.send).not.toHaveBeenCalled()
  })

  it('broadcasts to multiple subscribers in the same room', () => {
    const rooms = new WsRooms()
    const ws1 = makeFakeWs('a')
    const ws2 = makeFakeWs('b')
    rooms.subscribe('org:1', ws1)
    rooms.subscribe('org:1', ws2)
    rooms.broadcast('org:1', { type: 'project.deleted', payload: { id: 'p1' } })
    expect(ws1.send).toHaveBeenCalledOnce()
    expect(ws2.send).toHaveBeenCalledOnce()
  })

  it('stops broadcasting after unsubscribe', () => {
    const rooms = new WsRooms()
    const ws = makeFakeWs('a')
    rooms.subscribe('project:1', ws)
    rooms.unsubscribe(ws)
    rooms.broadcast('project:1', { type: 'task.deleted', payload: { id: 'x', projectId: '1' } })
    expect(ws.send).not.toHaveBeenCalled()
  })

  it('unsubscribe removes ws from all rooms', () => {
    const rooms = new WsRooms()
    const ws = makeFakeWs('a')
    rooms.subscribe('org:1', ws)
    rooms.subscribe('project:1', ws)
    rooms.unsubscribe(ws)
    rooms.broadcast('org:1', { type: 'project.deleted', payload: { id: 'p1' } })
    rooms.broadcast('project:1', { type: 'task.deleted', payload: { id: 'x', projectId: '1' } })
    expect(ws.send).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && pnpm test tests/features/ws-rooms.test.ts
```

Expected: FAIL — `ws-rooms.ts` not found.

- [ ] **Step 3: Implement WsRooms**

Create `apps/api/src/features/ws/ws-rooms.ts`:

```typescript
import type { WSContext } from 'hono/ws'
import type { WsEvent } from '../../types.js'

export class WsRooms {
  private rooms = new Map<string, Set<WSContext>>()

  subscribe(room: string, ws: WSContext): void {
    if (!this.rooms.has(room)) this.rooms.set(room, new Set())
    this.rooms.get(room)!.add(ws)
  }

  unsubscribe(ws: WSContext): void {
    for (const sockets of this.rooms.values()) {
      sockets.delete(ws)
    }
  }

  broadcast(room: string, event: WsEvent): void {
    const sockets = this.rooms.get(room)
    if (!sockets?.size) return
    const msg = JSON.stringify(event)
    for (const ws of sockets) {
      try {
        ws.send(msg)
      } catch {
        // client disconnected mid-broadcast — safe to ignore
      }
    }
  }
}
```

- [ ] **Step 4: Run to verify passing**

```bash
cd apps/api && pnpm test tests/features/ws-rooms.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/features/ws/ws-rooms.ts apps/api/src/tests/features/ws-rooms.test.ts
git commit -m "feat: WsRooms pub/sub class with subscribe/unsubscribe/broadcast"
```

---

## Task 3: WebSocket Route

**Files:**
- Create: `apps/api/src/features/ws/ws.routes.ts`

No HTTP-level integration test for WS (requires actual WS client). The route is used in Task 10.

- [ ] **Step 1: Create `apps/api/src/features/ws/ws.routes.ts`**

```typescript
import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import type { UpgradeWebSocket } from 'hono/ws'
import type { AppDb, HonoEnv } from '../../types.js'
import type { WsRooms } from './ws-rooms.js'
import { verifyAccessToken } from '../../lib/jwt.js'
import { memberships, projects } from '../../db/schema/index.js'

export function wsRoutes(
  db: AppDb,
  wsRooms: WsRooms,
  upgradeWebSocket: UpgradeWebSocket
): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>()

  router.get(
    '/',
    upgradeWebSocket((c) => {
      // Closure-per-connection: captures userId once auth succeeds
      let userId: string | undefined

      return {
        async onOpen(_event, ws) {
          const token = c.req.query('token')
          if (!token) {
            ws.close(1008, 'Missing token')
            return
          }
          try {
            const payload = await verifyAccessToken(token)
            userId = payload.sub
          } catch {
            ws.close(1008, 'Invalid token')
            return
          }

          // Auto-subscribe to all org rooms the user belongs to
          const userOrgs = db
            .select({ organizationId: memberships.organizationId })
            .from(memberships)
            .where(eq(memberships.userId, userId))
            .all()

          for (const { organizationId } of userOrgs) {
            wsRooms.subscribe(`org:${organizationId}`, ws)
          }
        },

        onMessage(event, ws) {
          if (!userId) return
          try {
            const msg = JSON.parse(event.data.toString()) as { type?: string; room?: string }
            if (
              msg.type === 'subscribe' &&
              typeof msg.room === 'string' &&
              msg.room.startsWith('project:')
            ) {
              const projectId = msg.room.slice('project:'.length)
              const project = db
                .select({ organizationId: projects.organizationId })
                .from(projects)
                .where(eq(projects.id, projectId))
                .get()
              if (!project) return
              const mem = db
                .select({ role: memberships.role })
                .from(memberships)
                .where(
                  and(
                    eq(memberships.userId, userId!),
                    eq(memberships.organizationId, project.organizationId)
                  )
                )
                .get()
              if (mem) wsRooms.subscribe(`project:${projectId}`, ws)
            }
          } catch {
            // ignore malformed messages
          }
        },

        onClose(_event, ws) {
          wsRooms.unsubscribe(ws)
        },
      }
    })
  )

  return router
}
```

- [ ] **Step 2: Run full test suite to confirm no regressions**

```bash
cd apps/api && pnpm test
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/ws/ws.routes.ts
git commit -m "feat: WebSocket upgrade route with token auth and room subscription"
```

---

## Task 4: requireProjectMember Middleware

**Files:**
- Create: `apps/api/src/middleware/project-member.ts`

This middleware is tested implicitly via the task route integration tests in Tasks 7–9.

- [ ] **Step 1: Create `apps/api/src/middleware/project-member.ts`**

```typescript
import { eq, and } from 'drizzle-orm'
import type { Context, MiddlewareHandler } from 'hono'
import type { AppDb, HonoEnv } from '../types.js'
import { forbidden, notFound } from '../lib/errors.js'
import { projects, memberships } from '../db/schema/index.js'

/**
 * Looks up the project from :projectId param, checks org membership,
 * and sets orgId in context so downstream handlers can use it.
 */
export function makeProjectAuthz(db: AppDb) {
  return {
    requireProjectMember(): MiddlewareHandler<HonoEnv> {
      return async (c, next) => {
        const userId = c.get('userId')
        const projectId = c.req.param('projectId')

        const project = db
          .select({ organizationId: projects.organizationId })
          .from(projects)
          .where(eq(projects.id, projectId))
          .get()

        if (!project) throw notFound('Project not found')

        const membership = db
          .select({ role: memberships.role })
          .from(memberships)
          .where(
            and(
              eq(memberships.userId, userId),
              eq(memberships.organizationId, project.organizationId)
            )
          )
          .get()

        if (!membership) throw forbidden()

        c.set('orgId', project.organizationId)
        await next()
      }
    },
  }
}
```

- [ ] **Step 2: Run tests**

```bash
cd apps/api && pnpm test
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/middleware/project-member.ts
git commit -m "feat: requireProjectMember middleware (project lookup + org membership check)"
```

---

## Task 5: Project Service + Routes

**Files:**
- Create: `apps/api/src/features/project/project.service.ts`
- Create: `apps/api/src/features/project/project.routes.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/src/tests/features/project.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/tests/features/project.test.ts`:

```typescript
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
  const user = await idSvc.register({ email: 'bob@example.com', password: 'password123', displayName: 'Bob' })

  const org = orgSvc.createOrg(user.id, { name: 'Acme' })

  // Alice is not a member of org — used to test 403
  const aliceTokenForAcme = accessToken

  // Create org as Alice
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
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && pnpm test tests/features/project.test.ts
```

Expected: FAIL — routes not mounted.

- [ ] **Step 3: Create `apps/api/src/features/project/project.service.ts`**

```typescript
import { eq } from 'drizzle-orm'
import type { AppDb, Broadcaster } from '../../types.js'
import { noopBroadcaster } from '../../types.js'
import type { ProjectDto } from '@kanban/shared'
import { generateId } from '../../lib/id.js'
import { notFound } from '../../lib/errors.js'
import { projects } from '../../db/schema/index.js'

function toDto(row: typeof projects.$inferSelect): ProjectDto {
  return { id: row.id, organizationId: row.organizationId, name: row.name, createdAt: row.createdAt }
}

export class ProjectService {
  constructor(
    private readonly db: AppDb,
    private readonly broadcast: Broadcaster = noopBroadcaster
  ) {}

  createProject(orgId: string, input: { name: string }): ProjectDto {
    const id = generateId()
    const row = this.db
      .insert(projects)
      .values({ id, organizationId: orgId, name: input.name })
      .returning()
      .get()
    if (!row) throw new Error('Failed to create project')
    const dto = toDto(row)
    this.broadcast(`org:${orgId}`, { type: 'project.created', payload: dto })
    return dto
  }

  listProjects(orgId: string): ProjectDto[] {
    return this.db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, orgId))
      .all()
      .map(toDto)
  }

  getProject(projectId: string): ProjectDto | undefined {
    const row = this.db.select().from(projects).where(eq(projects.id, projectId)).get()
    return row ? toDto(row) : undefined
  }

  updateProject(orgId: string, projectId: string, input: { name: string }): ProjectDto {
    const existing = this.db.select().from(projects).where(eq(projects.id, projectId)).get()
    if (!existing) throw notFound('Project not found')
    const updated = this.db
      .update(projects)
      .set({ name: input.name })
      .where(eq(projects.id, projectId))
      .returning()
      .get()
    if (!updated) throw new Error('Failed to update project')
    const dto = toDto(updated)
    this.broadcast(`org:${orgId}`, { type: 'project.updated', payload: dto })
    return dto
  }

  deleteProject(orgId: string, projectId: string): void {
    const existing = this.db.select().from(projects).where(eq(projects.id, projectId)).get()
    if (!existing) throw notFound('Project not found')
    this.db.delete(projects).where(eq(projects.id, projectId)).run()
    this.broadcast(`org:${orgId}`, { type: 'project.deleted', payload: { id: projectId } })
  }
}
```

- [ ] **Step 4: Create `apps/api/src/features/project/project.routes.ts`**

```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppDb, Broadcaster, HonoEnv } from '../../types.js'
import { noopBroadcaster } from '../../types.js'
import { authnMiddleware } from '../../middleware/authn.js'
import { makeAuthz } from '../../middleware/authz.js'
import { ProjectService } from './project.service.js'
import { notFound } from '../../lib/errors.js'

const createProjectSchema = z.object({ name: z.string().min(1).max(200) })
const updateProjectSchema = z.object({ name: z.string().min(1).max(200) })

export function projectRoutes(
  db: AppDb,
  broadcast: Broadcaster = noopBroadcaster
): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>()
  const svc = new ProjectService(db, broadcast)
  const authz = makeAuthz(db)

  router.use('*', authnMiddleware)

  router.get(
    '/:orgId/projects',
    authz.requireOrgRole('member', (c) => c.req.param('orgId')),
    (c) => c.json(svc.listProjects(c.req.param('orgId')))
  )

  router.post(
    '/:orgId/projects',
    authz.requireOrgRole('member', (c) => c.req.param('orgId')),
    zValidator('json', createProjectSchema),
    (c) => {
      const project = svc.createProject(c.req.param('orgId'), c.req.valid('json'))
      return c.json(project, 201)
    }
  )

  router.get(
    '/:orgId/projects/:projectId',
    authz.requireOrgRole('member', (c) => c.req.param('orgId')),
    (c) => {
      const project = svc.getProject(c.req.param('projectId'))
      if (!project) throw notFound('Project not found')
      return c.json(project)
    }
  )

  router.patch(
    '/:orgId/projects/:projectId',
    authz.requireOrgRole('manager', (c) => c.req.param('orgId')),
    zValidator('json', updateProjectSchema),
    (c) => {
      const project = svc.updateProject(
        c.req.param('orgId'),
        c.req.param('projectId'),
        c.req.valid('json')
      )
      return c.json(project)
    }
  )

  router.delete(
    '/:orgId/projects/:projectId',
    authz.requireOrgRole('manager', (c) => c.req.param('orgId')),
    (c) => {
      svc.deleteProject(c.req.param('orgId'), c.req.param('projectId'))
      return c.json({ success: true })
    }
  )

  return router
}
```

- [ ] **Step 5: Update `apps/api/src/app.ts`**

```typescript
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppDb, Broadcaster, HonoEnv } from './types.js'
import { noopBroadcaster } from './types.js'
import { identityRoutes } from './features/identity/identity.routes.js'
import { organizationRoutes } from './features/organization/organization.routes.js'
import { invitationRoutes } from './features/invitation/invitation.routes.js'
import { apiKeyRoutes } from './features/api-key/api-key.routes.js'
import { projectRoutes } from './features/project/project.routes.js'

export function createApp(
  db: AppDb,
  broadcast: Broadcaster = noopBroadcaster
): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>()

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status)
    }
    console.error(err)
    return c.json({ error: 'Internal server error' }, 500)
  })

  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.route('/auth', identityRoutes(db))
  app.route('/organizations', organizationRoutes(db))
  app.route('/organizations', projectRoutes(db, broadcast))
  app.route('/invite', invitationRoutes(db))
  app.route('/profile', apiKeyRoutes(db))

  return app
}
```

- [ ] **Step 6: Run tests**

```bash
cd apps/api && pnpm test
```

Expected: all project tests pass, all prior tests still pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/features/project/ apps/api/src/app.ts apps/api/src/tests/features/project.test.ts
git commit -m "feat: project CRUD service and routes under /organizations/:orgId/projects"
```

---

## Task 6: Task Service Core

**Files:**
- Create: `apps/api/src/features/task/task.service.ts`
- Create: `apps/api/src/tests/features/task.service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/tests/features/task.service.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestDb } from '../../db/test-utils.js'
import { IdentityService } from '../../features/identity/identity.service.js'
import { OrganizationService } from '../../features/organization/organization.service.js'
import { ProjectService } from '../../features/project/project.service.js'
import { TaskService } from '../../features/task/task.service.js'

beforeAll(() => {
  process.env['JWT_SECRET'] = 'test-jwt-secret-must-be-at-least-32-chars!!'
  process.env['NODE_ENV'] = 'test'
})

async function setup() {
  const testDb = createTestDb()
  const idSvc = new IdentityService(testDb.db)
  const orgSvc = new OrganizationService(testDb.db)
  const projSvc = new ProjectService(testDb.db)
  const taskSvc = new TaskService(testDb.db)

  const user = await idSvc.register({ email: 'alice@example.com', password: 'pass', displayName: 'Alice' })
  const org = orgSvc.createOrg(user.id, { name: 'Acme' })
  const project = projSvc.createProject(org.id, { name: 'Sprint 1' })

  return { testDb, user, org, project, taskSvc }
}

const baseTask = {
  title: 'Fix bug',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
}

describe('TaskService.createTask', () => {
  it('returns a full TaskDto', async () => {
    const { user, project, taskSvc, testDb } = await setup()
    const task = taskSvc.createTask(project.id, user.id, baseTask)
    expect(task.id).toBeTruthy()
    expect(task.title).toBe('Fix bug')
    expect(task.column).toBe('todo')
    expect(task.reporter.id).toBe(user.id)
    expect(task.reporter.displayName).toBe('Alice')
    expect(task.doer).toBeNull()
    expect(task.tags).toEqual([])
    expect(task.linkedTaskIds).toEqual([])
    testDb.close()
  })

  it('assigns sequential positions within the same column', async () => {
    const { user, project, taskSvc, testDb } = await setup()
    const t1 = taskSvc.createTask(project.id, user.id, { ...baseTask, title: 'T1' })
    const t2 = taskSvc.createTask(project.id, user.id, { ...baseTask, title: 'T2' })
    expect(t2.position).toBeGreaterThan(t1.position)
    testDb.close()
  })
})

describe('TaskService.getTask', () => {
  it('returns the task', async () => {
    const { user, project, taskSvc, testDb } = await setup()
    const created = taskSvc.createTask(project.id, user.id, baseTask)
    const found = taskSvc.getTask(created.id)
    expect(found?.title).toBe('Fix bug')
    testDb.close()
  })

  it('returns undefined for unknown id', async () => {
    const { taskSvc, testDb } = await setup()
    expect(taskSvc.getTask('nonexistent')).toBeUndefined()
    testDb.close()
  })
})

describe('TaskService.listTasks', () => {
  it('returns all tasks for the project', async () => {
    const { user, project, taskSvc, testDb } = await setup()
    taskSvc.createTask(project.id, user.id, { ...baseTask, title: 'A' })
    taskSvc.createTask(project.id, user.id, { ...baseTask, title: 'B' })
    const list = taskSvc.listTasks(project.id)
    expect(list.length).toBe(2)
    testDb.close()
  })
})

describe('TaskService.updateTask', () => {
  it('updates title and writes history', async () => {
    const { user, project, taskSvc, testDb } = await setup()
    const created = taskSvc.createTask(project.id, user.id, baseTask)
    const updated = taskSvc.updateTask(created.id, user.id, { title: 'Fixed bug' })
    expect(updated.title).toBe('Fixed bug')
    const history = taskSvc.getTaskHistory(created.id)
    expect(history.length).toBe(1)
    expect(history[0]?.field).toBe('title')
    expect(history[0]?.oldValue).toBe('Fix bug')
    expect(history[0]?.newValue).toBe('Fixed bug')
    testDb.close()
  })

  it('groups multi-field update under same batchId', async () => {
    const { user, project, taskSvc, testDb } = await setup()
    const created = taskSvc.createTask(project.id, user.id, baseTask)
    taskSvc.updateTask(created.id, user.id, { title: 'New', description: 'Desc' })
    const history = taskSvc.getTaskHistory(created.id)
    expect(history.length).toBe(2)
    expect(history[0]?.batchId).toBe(history[1]?.batchId)
    expect(history[0]?.batchId).toBeTruthy()
    testDb.close()
  })

  it('skips unchanged fields in history', async () => {
    const { user, project, taskSvc, testDb } = await setup()
    const created = taskSvc.createTask(project.id, user.id, baseTask)
    taskSvc.updateTask(created.id, user.id, { title: 'Fix bug' }) // same title
    expect(taskSvc.getTaskHistory(created.id).length).toBe(0)
    testDb.close()
  })
})

describe('TaskService.deleteTask', () => {
  it('removes the task', async () => {
    const { user, project, taskSvc, testDb } = await setup()
    const created = taskSvc.createTask(project.id, user.id, baseTask)
    taskSvc.deleteTask(created.id)
    expect(taskSvc.getTask(created.id)).toBeUndefined()
    testDb.close()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && pnpm test tests/features/task.service.test.ts
```

Expected: FAIL — `task.service.ts` not found.

- [ ] **Step 3: Create `apps/api/src/features/task/task.service.ts`**

```typescript
import { eq, and, or, max, sql } from 'drizzle-orm'
import type { AppDb, Broadcaster } from '../../types.js'
import { noopBroadcaster } from '../../types.js'
import type { TaskDto, TaskHistoryDto, Column } from '@kanban/shared'
import { generateId } from '../../lib/id.js'
import { notFound, unprocessable } from '../../lib/errors.js'
import {
  tasks,
  taskTags,
  taskLinks,
  taskWatchers,
  taskAdvisors,
  taskHistory,
  users,
} from '../../db/schema/index.js'

// ---------- assembly helper ----------

function assembleTaskDto(
  db: AppDb,
  row: typeof tasks.$inferSelect
): TaskDto {
  const reporter = db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, row.reporterId))
    .get()!

  const doer = row.doerId
    ? (db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, row.doerId))
        .get() ?? null)
    : null

  const validator = row.validatorId
    ? (db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, row.validatorId))
        .get() ?? null)
    : null

  const tags = db
    .select({ tag: taskTags.tag })
    .from(taskTags)
    .where(eq(taskTags.taskId, row.id))
    .all()
    .map((r) => r.tag)

  const links = db
    .select()
    .from(taskLinks)
    .where(or(eq(taskLinks.taskId, row.id), eq(taskLinks.linkedTaskId, row.id)))
    .all()

  const linkedTaskIds = links.map((l) =>
    l.taskId === row.id ? l.linkedTaskId : l.taskId
  )

  const watchers = db
    .select({ id: users.id, displayName: users.displayName })
    .from(taskWatchers)
    .innerJoin(users, eq(taskWatchers.userId, users.id))
    .where(eq(taskWatchers.taskId, row.id))
    .all()

  const advisors = db
    .select({ id: users.id, displayName: users.displayName })
    .from(taskAdvisors)
    .innerJoin(users, eq(taskAdvisors.userId, users.id))
    .where(eq(taskAdvisors.taskId, row.id))
    .all()

  return {
    id: row.id,
    projectId: row.projectId,
    column: row.column as Column,
    title: row.title,
    description: row.description,
    objective: row.objective,
    startDate: row.startDate,
    endDate: row.endDate,
    backgroundColor: row.backgroundColor,
    globalSubject: row.globalSubject,
    position: row.position,
    reporter,
    doer,
    validator,
    watchers,
    advisors,
    tags,
    linkedTaskIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// ---------- service ----------

export class TaskService {
  constructor(
    private readonly db: AppDb,
    private readonly broadcast: Broadcaster = noopBroadcaster
  ) {}

  private nextPosition(projectId: string, column: Column): number {
    const result = this.db
      .select({ pos: max(tasks.position) })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.column, column)))
      .get()
    return (result?.pos ?? 0) + 1
  }

  private getRow(taskId: string): typeof tasks.$inferSelect {
    const row = this.db.select().from(tasks).where(eq(tasks.id, taskId)).get()
    if (!row) throw notFound('Task not found')
    return row
  }

  createTask(
    projectId: string,
    reporterId: string,
    input: {
      title: string
      description?: string | null
      objective?: string | null
      startDate: string
      endDate: string
      backgroundColor?: string | null
      globalSubject?: string | null
      column?: Column
      doerId?: string | null
      validatorId?: string | null
    }
  ): TaskDto {
    const column: Column = input.column ?? 'todo'
    const id = generateId()
    const position = this.nextPosition(projectId, column)
    const row = this.db
      .insert(tasks)
      .values({
        id,
        projectId,
        reporterId,
        column,
        title: input.title,
        description: input.description ?? null,
        objective: input.objective ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        backgroundColor: input.backgroundColor ?? null,
        globalSubject: input.globalSubject ?? null,
        doerId: input.doerId ?? null,
        validatorId: input.validatorId ?? null,
        position,
      })
      .returning()
      .get()
    if (!row) throw new Error('Failed to create task')
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${projectId}`, { type: 'task.created', payload: dto })
    return dto
  }

  getTask(taskId: string): TaskDto | undefined {
    const row = this.db.select().from(tasks).where(eq(tasks.id, taskId)).get()
    return row ? assembleTaskDto(this.db, row) : undefined
  }

  listTasks(projectId: string): TaskDto[] {
    const rows = this.db.select().from(tasks).where(eq(tasks.projectId, projectId)).all()
    return rows.map((r) => assembleTaskDto(this.db, r))
  }

  updateTask(
    taskId: string,
    actorId: string,
    input: {
      title?: string
      description?: string | null
      objective?: string | null
      startDate?: string
      endDate?: string
      backgroundColor?: string | null
      globalSubject?: string | null
      doerId?: string | null
      validatorId?: string | null
    }
  ): TaskDto {
    const existing = this.getRow(taskId)
    const batchId = generateId()
    const historyEntries: Array<typeof taskHistory.$inferInsert> = []
    const updateSet: Record<string, unknown> = {}

    const track = (
      field: string,
      oldVal: string | null,
      newVal: string | null
    ) => {
      if (oldVal !== newVal) {
        historyEntries.push({
          id: generateId(),
          taskId,
          userId: actorId,
          field,
          oldValue: oldVal,
          newValue: newVal,
          batchId,
        })
        updateSet[field] = newVal
      }
    }

    if (input.title !== undefined) track('title', existing.title, input.title)
    if (input.description !== undefined) track('description', existing.description, input.description)
    if (input.objective !== undefined) track('objective', existing.objective, input.objective)
    if (input.startDate !== undefined) track('startDate', existing.startDate, input.startDate)
    if (input.endDate !== undefined) track('endDate', existing.endDate, input.endDate)
    if (input.backgroundColor !== undefined) track('backgroundColor', existing.backgroundColor, input.backgroundColor)
    if (input.globalSubject !== undefined) track('globalSubject', existing.globalSubject, input.globalSubject)
    if (input.doerId !== undefined) track('doerId', existing.doerId, input.doerId)
    if (input.validatorId !== undefined) track('validatorId', existing.validatorId, input.validatorId)

    if (historyEntries.length > 0) {
      this.db
        .update(tasks)
        .set({ ...updateSet, updatedAt: sql`(datetime('now'))` })
        .where(eq(tasks.id, taskId))
        .run()
      for (const entry of historyEntries) {
        this.db.insert(taskHistory).values(entry).run()
      }
    }

    const updated = this.getRow(taskId)
    const dto = assembleTaskDto(this.db, updated)
    this.broadcast(`project:${existing.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  deleteTask(taskId: string): void {
    const existing = this.getRow(taskId)
    this.db.delete(tasks).where(eq(tasks.id, taskId)).run()
    this.broadcast(`project:${existing.projectId}`, {
      type: 'task.deleted',
      payload: { id: taskId, projectId: existing.projectId },
    })
  }

  getTaskHistory(taskId: string): TaskHistoryDto[] {
    const rows = this.db
      .select()
      .from(taskHistory)
      .where(eq(taskHistory.taskId, taskId))
      .all()

    return rows.map((r) => {
      const actor = this.db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, r.userId))
        .get()!
      return {
        id: r.id,
        taskId: r.taskId,
        actor,
        field: r.field,
        oldValue: r.oldValue,
        newValue: r.newValue,
        changedAt: r.changedAt,
        batchId: r.batchId,
      }
    })
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && pnpm test tests/features/task.service.test.ts
```

Expected: all task service tests pass.

- [ ] **Step 5: Run full suite**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/features/task/task.service.ts apps/api/src/tests/features/task.service.test.ts
git commit -m "feat: TaskService with CRUD, assembleTaskDto, and per-field history"
```

---

## Task 7: Task Routes (Core CRUD + History)

**Files:**
- Create: `apps/api/src/features/task/task.routes.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/src/tests/features/task.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/tests/features/task.test.ts`:

```typescript
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

  await idSvc.register({ email: 'alice@example.com', password: 'pass', displayName: 'Alice' })
  const { accessToken } = await idSvc.login({ email: 'alice@example.com', password: 'password' })

  // Manually get token — login uses correct password
  const loginRes = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice@example.com', password: 'pass' }),
  })
  const { accessToken: token } = (await loginRes.json()) as { accessToken: string }

  // Create org + project via API
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

  return { app, token, orgId, projectId, close: testDb.close }
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

const baseTask = {
  title: 'Fix bug',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
}

describe('POST /projects/:projectId/tasks', () => {
  it('creates a task and returns 201 with full dto', async () => {
    const { app, token, projectId, close } = await setup()
    const res = await app.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(baseTask),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; title: string; column: string; tags: string[] }
    expect(body.title).toBe('Fix bug')
    expect(body.column).toBe('todo')
    expect(body.tags).toEqual([])
    close()
  })

  it('returns 401 without auth', async () => {
    const { app, projectId, close } = await setup()
    const res = await app.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseTask),
    })
    expect(res.status).toBe(401)
    close()
  })

  it('returns 403 for non-member', async () => {
    const { app, projectId, close } = await setup()
    // Register second user
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@example.com', password: 'pass', displayName: 'Bob' }),
    })
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@example.com', password: 'pass' }),
    })
    const { accessToken: bobToken } = (await loginRes.json()) as { accessToken: string }
    const res = await app.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { ...auth(bobToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(baseTask),
    })
    expect(res.status).toBe(403)
    close()
  })
})

describe('GET /projects/:projectId/tasks', () => {
  it('returns list of tasks', async () => {
    const { app, token, projectId, close } = await setup()
    await app.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseTask, title: 'T1' }),
    })
    await app.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseTask, title: 'T2' }),
    })
    const res = await app.request(`/projects/${projectId}/tasks`, { headers: auth(token) })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string }[]
    expect(body.length).toBe(2)
    close()
  })
})

describe('GET /projects/:projectId/tasks/:taskId', () => {
  it('returns the task', async () => {
    const { app, token, projectId, close } = await setup()
    const cr = await app.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(baseTask),
    })
    const { id: taskId } = (await cr.json()) as { id: string }
    const res = await app.request(`/projects/${projectId}/tasks/${taskId}`, { headers: auth(token) })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { title: string }
    expect(body.title).toBe('Fix bug')
    close()
  })
})

describe('PATCH /projects/:projectId/tasks/:taskId', () => {
  it('updates the task title', async () => {
    const { app, token, projectId, close } = await setup()
    const cr = await app.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(baseTask),
    })
    const { id: taskId } = (await cr.json()) as { id: string }
    const res = await app.request(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Fixed' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { title: string }
    expect(body.title).toBe('Fixed')
    close()
  })
})

describe('DELETE /projects/:projectId/tasks/:taskId', () => {
  it('deletes the task', async () => {
    const { app, token, projectId, close } = await setup()
    const cr = await app.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(baseTask),
    })
    const { id: taskId } = (await cr.json()) as { id: string }
    const res = await app.request(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: auth(token),
    })
    expect(res.status).toBe(200)
    close()
  })
})

describe('GET /projects/:projectId/tasks/:taskId/history', () => {
  it('returns history after an update', async () => {
    const { app, token, projectId, close } = await setup()
    const cr = await app.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(baseTask),
    })
    const { id: taskId } = (await cr.json()) as { id: string }
    await app.request(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await app.request(`/projects/${projectId}/tasks/${taskId}/history`, {
      headers: auth(token),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { field: string; oldValue: string }[]
    expect(body.length).toBe(1)
    expect(body[0]?.field).toBe('title')
    close()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && pnpm test tests/features/task.test.ts
```

Expected: FAIL — task routes not mounted.

- [ ] **Step 3: Create `apps/api/src/features/task/task.routes.ts`**

```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppDb, Broadcaster, HonoEnv } from '../../types.js'
import { noopBroadcaster } from '../../types.js'
import { authnMiddleware } from '../../middleware/authn.js'
import { makeProjectAuthz } from '../../middleware/project-member.js'
import { TaskService } from './task.service.js'
import { notFound } from '../../lib/errors.js'

const columnEnum = z.enum(['ideas', 'todo', 'doing', 'done'])

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  startDate: z.string(),
  endDate: z.string(),
  backgroundColor: z.string().nullable().optional(),
  globalSubject: z.string().nullable().optional(),
  column: columnEnum.optional(),
  doerId: z.string().uuid().nullable().optional(),
  validatorId: z.string().uuid().nullable().optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  backgroundColor: z.string().nullable().optional(),
  globalSubject: z.string().nullable().optional(),
  doerId: z.string().uuid().nullable().optional(),
  validatorId: z.string().uuid().nullable().optional(),
})

export function taskRoutes(
  db: AppDb,
  broadcast: Broadcaster = noopBroadcaster
): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>()
  const svc = new TaskService(db, broadcast)
  const projectAuthz = makeProjectAuthz(db)

  router.use('*', authnMiddleware)

  // All task routes require project membership
  router.use('/:projectId/*', projectAuthz.requireProjectMember())

  // CRUD
  router.get('/:projectId/tasks', (c) => c.json(svc.listTasks(c.req.param('projectId'))))

  router.post(
    '/:projectId/tasks',
    zValidator('json', createTaskSchema),
    (c) => {
      const task = svc.createTask(
        c.req.param('projectId'),
        c.get('userId'),
        c.req.valid('json')
      )
      return c.json(task, 201)
    }
  )

  router.get('/:projectId/tasks/:taskId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(task)
  })

  router.patch(
    '/:projectId/tasks/:taskId',
    zValidator('json', updateTaskSchema),
    (c) => {
      const task = svc.getTask(c.req.param('taskId'))
      if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
      return c.json(svc.updateTask(c.req.param('taskId'), c.get('userId'), c.req.valid('json')))
    }
  )

  router.delete('/:projectId/tasks/:taskId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    svc.deleteTask(c.req.param('taskId'))
    return c.json({ success: true })
  })

  router.get('/:projectId/tasks/:taskId/history', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.getTaskHistory(c.req.param('taskId')))
  })

  return router
}
```

- [ ] **Step 4: Update `apps/api/src/app.ts` to mount task routes**

```typescript
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppDb, Broadcaster, HonoEnv } from './types.js'
import { noopBroadcaster } from './types.js'
import { identityRoutes } from './features/identity/identity.routes.js'
import { organizationRoutes } from './features/organization/organization.routes.js'
import { invitationRoutes } from './features/invitation/invitation.routes.js'
import { apiKeyRoutes } from './features/api-key/api-key.routes.js'
import { projectRoutes } from './features/project/project.routes.js'
import { taskRoutes } from './features/task/task.routes.js'

export function createApp(
  db: AppDb,
  broadcast: Broadcaster = noopBroadcaster
): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>()

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status)
    }
    console.error(err)
    return c.json({ error: 'Internal server error' }, 500)
  })

  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.route('/auth', identityRoutes(db))
  app.route('/organizations', organizationRoutes(db))
  app.route('/organizations', projectRoutes(db, broadcast))
  app.route('/projects', taskRoutes(db, broadcast))
  app.route('/invite', invitationRoutes(db))
  app.route('/profile', apiKeyRoutes(db))

  return app
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass including the new task tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/features/task/task.routes.ts apps/api/src/app.ts apps/api/src/tests/features/task.test.ts
git commit -m "feat: task CRUD routes under /projects/:projectId/tasks with history endpoint"
```

---

## Task 8: Task Relations (Tags, Links, Watchers, Advisors)

**Files:**
- Modify: `apps/api/src/features/task/task.service.ts`
- Modify: `apps/api/src/features/task/task.routes.ts`
- Create: `apps/api/src/tests/features/task-relations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/tests/features/task-relations.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && pnpm test tests/features/task-relations.test.ts
```

Expected: FAIL — relation routes not implemented.

- [ ] **Step 3: Add relation methods to `apps/api/src/features/task/task.service.ts`**

Add these methods to the `TaskService` class (after `getTaskHistory`):

```typescript
  addTag(taskId: string, tag: string): TaskDto {
    const row = this.getRow(taskId)
    // ignore duplicate (primary key will silently fail via ON CONFLICT IGNORE — use try/catch)
    try {
      this.db.insert(taskTags).values({ taskId, tag }).run()
    } catch {
      // already exists — no-op
    }
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  removeTag(taskId: string, tag: string): TaskDto {
    const row = this.getRow(taskId)
    this.db.delete(taskTags).where(and(eq(taskTags.taskId, taskId), eq(taskTags.tag, tag))).run()
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  addLink(taskId: string, linkedTaskId: string): TaskDto {
    const row = this.getRow(taskId)
    this.getRow(linkedTaskId) // verify exists
    try {
      this.db.insert(taskLinks).values({ taskId, linkedTaskId }).run()
    } catch {
      // duplicate or reverse already exists — no-op
    }
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  removeLink(taskId: string, linkedTaskId: string): TaskDto {
    const row = this.getRow(taskId)
    // undirected: try both orientations
    this.db.delete(taskLinks).where(
      or(
        and(eq(taskLinks.taskId, taskId), eq(taskLinks.linkedTaskId, linkedTaskId)),
        and(eq(taskLinks.taskId, linkedTaskId), eq(taskLinks.linkedTaskId, taskId))
      )
    ).run()
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  addWatcher(taskId: string, userId: string, actorId: string): TaskDto {
    const row = this.getRow(taskId)
    try {
      this.db.insert(taskWatchers).values({ taskId, userId }).run()
      this.db.insert(taskHistory).values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: 'watchers',
        oldValue: null,
        newValue: userId,
        batchId: null,
      }).run()
    } catch {
      // already watching — no-op
    }
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  removeWatcher(taskId: string, userId: string, actorId: string): TaskDto {
    const row = this.getRow(taskId)
    const existing = this.db.select().from(taskWatchers)
      .where(and(eq(taskWatchers.taskId, taskId), eq(taskWatchers.userId, userId)))
      .get()
    if (existing) {
      this.db.delete(taskWatchers).where(
        and(eq(taskWatchers.taskId, taskId), eq(taskWatchers.userId, userId))
      ).run()
      this.db.insert(taskHistory).values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: 'watchers',
        oldValue: userId,
        newValue: null,
        batchId: null,
      }).run()
    }
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  addAdvisor(taskId: string, userId: string, actorId: string): TaskDto {
    const row = this.getRow(taskId)
    try {
      this.db.insert(taskAdvisors).values({ taskId, userId }).run()
      this.db.insert(taskHistory).values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: 'advisors',
        oldValue: null,
        newValue: userId,
        batchId: null,
      }).run()
    } catch {
      // already advising — no-op
    }
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  removeAdvisor(taskId: string, userId: string, actorId: string): TaskDto {
    const row = this.getRow(taskId)
    const existing = this.db.select().from(taskAdvisors)
      .where(and(eq(taskAdvisors.taskId, taskId), eq(taskAdvisors.userId, userId)))
      .get()
    if (existing) {
      this.db.delete(taskAdvisors).where(
        and(eq(taskAdvisors.taskId, taskId), eq(taskAdvisors.userId, userId))
      ).run()
      this.db.insert(taskHistory).values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: 'advisors',
        oldValue: userId,
        newValue: null,
        batchId: null,
      }).run()
    }
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }
```

- [ ] **Step 4: Add relation routes to `apps/api/src/features/task/task.routes.ts`**

Add these routes before `return router` in `taskRoutes`:

```typescript
  // Tags
  router.post('/:projectId/tasks/:taskId/tags/:tag', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.addTag(c.req.param('taskId'), c.req.param('tag')))
  })

  router.delete('/:projectId/tasks/:taskId/tags/:tag', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.removeTag(c.req.param('taskId'), c.req.param('tag')))
  })

  // Links
  router.post('/:projectId/tasks/:taskId/links/:linkedTaskId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.addLink(c.req.param('taskId'), c.req.param('linkedTaskId')))
  })

  router.delete('/:projectId/tasks/:taskId/links/:linkedTaskId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.removeLink(c.req.param('taskId'), c.req.param('linkedTaskId')))
  })

  // Watchers
  router.post('/:projectId/tasks/:taskId/watchers/:userId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.addWatcher(c.req.param('taskId'), c.req.param('userId'), c.get('userId')))
  })

  router.delete('/:projectId/tasks/:taskId/watchers/:userId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.removeWatcher(c.req.param('taskId'), c.req.param('userId'), c.get('userId')))
  })

  // Advisors
  router.post('/:projectId/tasks/:taskId/advisors/:userId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.addAdvisor(c.req.param('taskId'), c.req.param('userId'), c.get('userId')))
  })

  router.delete('/:projectId/tasks/:taskId/advisors/:userId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.removeAdvisor(c.req.param('taskId'), c.req.param('userId'), c.get('userId')))
  })
```

- [ ] **Step 5: Run tests**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass including relation tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/features/task/task.service.ts apps/api/src/features/task/task.routes.ts apps/api/src/tests/features/task-relations.test.ts
git commit -m "feat: task relations — tags, links, watchers, advisors with history for watchers/advisors"
```

---

## Task 9: Task Move + Reorder

**Files:**
- Modify: `apps/api/src/features/task/task.service.ts`
- Modify: `apps/api/src/features/task/task.routes.ts`
- Create: `apps/api/src/tests/features/task-move.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/tests/features/task-move.test.ts`:

```typescript
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

  async function createTask(title = 'Task') {
    const res = await app.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, startDate: '2026-01-01', endDate: '2026-12-31' }),
    })
    return (await res.json()) as { id: string; column: string; position: number; doer: null | { id: string } }
  }

  // Get alice's userId
  const { accessToken: tok2 } = await idSvc.login({ email: 'alice@example.com', password: 'pass' })
  const profileRes = await app.request('/profile/api-keys', { headers: { Authorization: `Bearer ${token}` } })
  // Use reporter id from a task instead
  const t = await createTask('probe')
  const tRes = await app.request(`/projects/${projectId}/tasks/${t.id}`, { headers: { Authorization: `Bearer ${token}` } })
  const { reporter } = (await tRes.json()) as { reporter: { id: string } }
  const aliceId = reporter.id

  return { app, token, orgId, projectId, createTask, aliceId, close: testDb.close }
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('POST /projects/:projectId/tasks/:taskId/move', () => {
  it('moves task to a new column', async () => {
    const { app, token, projectId, createTask, close } = await setup()
    const task = await createTask()

    const res = await app.request(`/projects/${projectId}/tasks/${task.id}/move`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ column: 'done' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { column: string }
    expect(body.column).toBe('done')
    close()
  })

  it('returns 422 when moving to doing without a doer', async () => {
    const { app, token, projectId, createTask, close } = await setup()
    const task = await createTask()

    const res = await app.request(`/projects/${projectId}/tasks/${task.id}/move`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ column: 'doing' }),
    })
    expect(res.status).toBe(422)
    close()
  })

  it('clears doer when moving from doing to todo', async () => {
    const { app, token, projectId, createTask, aliceId, close } = await setup()
    const task = await createTask()

    // Set doer first via update
    await app.request(`/projects/${projectId}/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ doerId: aliceId }),
    })

    // Move to doing (has doer now)
    await app.request(`/projects/${projectId}/tasks/${task.id}/move`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ column: 'doing' }),
    })

    // Move back to todo — doer should be cleared
    const res = await app.request(`/projects/${projectId}/tasks/${task.id}/move`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ column: 'todo' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { doer: null | object; column: string }
    expect(body.column).toBe('todo')
    expect(body.doer).toBeNull()
    close()
  })

  it('writes history for column change', async () => {
    const { app, token, projectId, createTask, close } = await setup()
    const task = await createTask()

    await app.request(`/projects/${projectId}/tasks/${task.id}/move`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ column: 'done' }),
    })

    const histRes = await app.request(`/projects/${projectId}/tasks/${task.id}/history`, { headers: auth(token) })
    const history = (await histRes.json()) as { field: string }[]
    expect(history.some((h) => h.field === 'column')).toBe(true)
    close()
  })
})

describe('POST /projects/:projectId/tasks/:taskId/reorder', () => {
  it('updates the position', async () => {
    const { app, token, projectId, createTask, close } = await setup()
    const t1 = await createTask('T1')
    const t2 = await createTask('T2')

    // Reorder t2 between position 0 and t1.position (fractional: 0.5)
    const newPos = t1.position / 2
    const res = await app.request(`/projects/${projectId}/tasks/${t2.id}/reorder`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: newPos }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { position: number }
    expect(body.position).toBeCloseTo(newPos)
    close()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && pnpm test tests/features/task-move.test.ts
```

Expected: FAIL — move/reorder routes not implemented.

- [ ] **Step 3: Add `moveTask` and `reorderTask` to `apps/api/src/features/task/task.service.ts`**

Add these methods to the `TaskService` class:

```typescript
  moveTask(
    taskId: string,
    actorId: string,
    input: { column: Column; position?: number }
  ): TaskDto {
    const row = this.getRow(taskId)
    const oldColumn = row.column as Column

    if (input.column === 'doing' && !row.doerId) {
      throw unprocessable('A doer must be assigned before moving to doing')
    }

    const clearsDoer = (input.column === 'ideas' || input.column === 'todo') && row.doerId !== null
    const position = input.position ?? this.nextPosition(row.projectId, input.column)

    const updateValues: Record<string, unknown> = {
      column: input.column,
      position,
      updatedAt: sql`(datetime('now'))`,
    }
    if (clearsDoer) updateValues['doerId'] = null

    this.db.update(tasks).set(updateValues).where(eq(tasks.id, taskId)).run()

    // History: column change
    this.db.insert(taskHistory).values({
      id: generateId(),
      taskId,
      userId: actorId,
      field: 'column',
      oldValue: oldColumn,
      newValue: input.column,
      batchId: null,
    }).run()

    if (clearsDoer) {
      this.db.insert(taskHistory).values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: 'doerId',
        oldValue: row.doerId,
        newValue: null,
        batchId: null,
      }).run()
    }

    const updated = this.getRow(taskId)
    const dto = assembleTaskDto(this.db, updated)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  reorderTask(taskId: string, position: number): TaskDto {
    const row = this.getRow(taskId)
    this.db
      .update(tasks)
      .set({ position, updatedAt: sql`(datetime('now'))` })
      .where(eq(tasks.id, taskId))
      .run()
    const updated = this.getRow(taskId)
    const dto = assembleTaskDto(this.db, updated)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }
```

- [ ] **Step 4: Add move + reorder routes to `apps/api/src/features/task/task.routes.ts`**

Add these routes before `return router`:

```typescript
  const moveSchema = z.object({
    column: columnEnum,
    position: z.number().positive().optional(),
  })

  const reorderSchema = z.object({
    position: z.number().positive(),
  })

  router.post(
    '/:projectId/tasks/:taskId/move',
    zValidator('json', moveSchema),
    (c) => {
      const task = svc.getTask(c.req.param('taskId'))
      if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
      return c.json(svc.moveTask(c.req.param('taskId'), c.get('userId'), c.req.valid('json')))
    }
  )

  router.post(
    '/:projectId/tasks/:taskId/reorder',
    zValidator('json', reorderSchema),
    (c) => {
      const task = svc.getTask(c.req.param('taskId'))
      if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
      return c.json(svc.reorderTask(c.req.param('taskId'), c.req.valid('json').position))
    }
  )
```

Also add the `moveSchema` and `reorderSchema` constants near the top of the function (or inline in the route definition as shown).

- [ ] **Step 5: Run tests**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/features/task/task.service.ts apps/api/src/features/task/task.routes.ts apps/api/src/tests/features/task-move.test.ts
git commit -m "feat: task move (column change with doer guard) and fractional reorder"
```

---

## Task 10: Wire WebSocket Broadcast into index.ts

**Files:**
- Modify: `apps/api/src/index.ts`

No new tests needed — existing services already accept `broadcast` and tests use `noopBroadcaster`. This task wires the real broadcaster in production only.

- [ ] **Step 1: Update `apps/api/src/index.ts`**

```typescript
import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { db } from './db/client.js'
import { runMigrations } from './db/migrate.js'
import { createApp } from './app.js'
import { WsRooms } from './features/ws/ws-rooms.js'
import { wsRoutes } from './features/ws/ws.routes.js'

runMigrations()

const wsRooms = new WsRooms()
const broadcast = wsRooms.broadcast.bind(wsRooms)
const app = createApp(db, broadcast)

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })
app.route('/ws', wsRoutes(db, wsRooms, upgradeWebSocket))

const port = Number(process.env['PORT'] ?? 3001)
const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}`)
})
injectWebSocket(server)
```

- [ ] **Step 2: Run full test suite**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass (tests use `createApp(db)` without WS — WS route is not added in tests, WsRooms is not created).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat: wire WsRooms broadcaster and @hono/node-ws into production entry point"
```

---

## Task 11: CSV Import

**Files:**
- Create: `apps/api/src/features/task/csv-import.ts`
- Modify: `apps/api/src/features/task/task.service.ts`
- Modify: `apps/api/src/features/task/task.routes.ts`
- Create: `apps/api/src/tests/features/task-import.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/tests/features/task-import.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && pnpm test tests/features/task-import.test.ts
```

Expected: FAIL — import route not implemented.

- [ ] **Step 3: Create `apps/api/src/features/task/csv-import.ts`**

```typescript
import { parse } from 'csv-parse/sync'
import type { Column } from '@kanban/shared'

const VALID_COLUMNS: Column[] = ['ideas', 'todo', 'doing', 'done']

export interface CsvTaskRow {
  title: string
  description: string | null
  objective: string | null
  startDate: string
  endDate: string
  column: Column
  backgroundColor: string | null
  globalSubject: string | null
}

export interface ParseResult {
  valid: CsvTaskRow[]
  skipped: number
}

export function parseCsvImport(csvText: string): ParseResult {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[]

  const valid: CsvTaskRow[] = []
  let skipped = 0

  for (const row of records) {
    if (!row['title'] || !row['startDate'] || !row['endDate']) {
      skipped++
      continue
    }
    const col = row['column'] ?? ''
    valid.push({
      title: row['title'],
      description: row['description'] || null,
      objective: row['objective'] || null,
      startDate: row['startDate'],
      endDate: row['endDate'],
      column: VALID_COLUMNS.includes(col as Column) ? (col as Column) : 'todo',
      backgroundColor: row['backgroundColor'] || null,
      globalSubject: row['globalSubject'] || null,
    })
  }

  return { valid, skipped }
}
```

- [ ] **Step 4: Add `importTasks` to `apps/api/src/features/task/task.service.ts`**

First add the import at the top of task.service.ts:

```typescript
import { parseCsvImport } from './csv-import.js'
```

Then add this method to the `TaskService` class:

```typescript
  importTasks(
    projectId: string,
    reporterId: string,
    csvText: string
  ): { imported: number; skipped: number } {
    const { valid, skipped } = parseCsvImport(csvText)

    const imported = this.db.transaction((tx) => {
      let count = 0
      for (const row of valid) {
        const maxResult = tx
          .select({ pos: max(tasks.position) })
          .from(tasks)
          .where(and(eq(tasks.projectId, projectId), eq(tasks.column, row.column)))
          .get()
        const position = (maxResult?.pos ?? 0) + 1
        const id = generateId()
        tx.insert(tasks).values({
          id,
          projectId,
          reporterId,
          column: row.column,
          title: row.title,
          description: row.description,
          objective: row.objective,
          startDate: row.startDate,
          endDate: row.endDate,
          backgroundColor: row.backgroundColor,
          globalSubject: row.globalSubject,
          doerId: null,
          validatorId: null,
          position,
        }).run()
        count++
      }
      return count
    })

    return { imported, skipped }
  }
```

- [ ] **Step 5: Add import route to `apps/api/src/features/task/task.routes.ts`**

Add before `return router`:

```typescript
  // CSV import
  router.post('/:projectId/import', async (c) => {
    const body = await c.req.parseBody()
    const file = body['file']
    if (!(file instanceof File)) throw unprocessable('file field required')
    const text = await file.text()
    const result = svc.importTasks(c.req.param('projectId'), c.get('userId'), text)
    return c.json(result, 201)
  })
```

Also add `unprocessable` to the import from `../../lib/errors.js` in task.routes.ts:

```typescript
import { notFound, unprocessable } from '../../lib/errors.js'
```

- [ ] **Step 6: Run tests**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass including the 4 CSV import tests.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/features/task/csv-import.ts apps/api/src/features/task/task.service.ts apps/api/src/features/task/task.routes.ts apps/api/src/tests/features/task-import.test.ts
git commit -m "feat: CSV import endpoint — bulk task creation with skip on invalid rows"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|------------|------|
| Project CRUD | Task 5 |
| requireProjectMember middleware | Task 4 |
| Task CRUD | Tasks 6+7 |
| Task history (per-field, batchId) | Task 6 |
| Task tags | Task 8 |
| Task links (undirected) | Task 8 |
| Task watchers + history | Task 8 |
| Task advisors + history | Task 8 |
| Task move (doer guard, clear doer on back-move) | Task 9 |
| Task reorder (fractional index) | Task 9 |
| WebSocket rooms (subscribe/broadcast) | Task 2 |
| WebSocket route (token auth, auto-sub org, project sub) | Task 3 |
| WS broadcast wired in production | Task 10 |
| CSV import (bulk, skip invalid, default column) | Task 11 |
| Types updated (Broadcaster, WsEvent, orgId) | Task 1 |

### Placeholder scan

No TBDs, TODOs, or vague requirements. Every step has explicit code.

### Type consistency

- `Broadcaster` defined in `types.ts`, imported by all services and routes
- `noopBroadcaster` defined in `types.ts`, imported where needed
- `WsEvent` discriminated union in `types.ts`, used by WsRooms
- `assembleTaskDto` is a module-level function — not exported (service-private detail)
- `TaskService.getRow(taskId)` used internally — throws `notFound` if missing
- `sql`, `max`, `or`, `eq`, `and` — all from `drizzle-orm`
- `Column` type from `@kanban/shared` — used in service and csv-import
