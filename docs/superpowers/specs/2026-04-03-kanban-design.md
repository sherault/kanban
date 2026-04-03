# Kanban App — Design Spec

**Date:** 2026-04-03
**Status:** Approved

---

## 1. Overview

A multi-project, multi-tenant, multi-user Kanban web application. Users belong to one or more Organizations. Each Organization contains one or more Projects. Each Project is a Kanban board with four columns. Real-time collaboration is supported via WebSockets. An MCP server is exposed so users can manage the app via an LLM client.

---

## 2. Repository Structure

```
kanban/
├── apps/
│   ├── api/          # Hono backend (domain logic, DB, WS, MCP)
│   └── web/          # Next.js 14 App Router (BFF + UI)
├── packages/
│   ├── shared/       # Shared TypeScript DTOs and enums (no DB shapes)
│   └── eslint-config/ # Shared ESLint + Prettier config
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

**Tooling:** pnpm workspaces + Turborepo, TypeScript throughout, ESLint (typescript-eslint) + Prettier.

---

## 3. Request Flow

```
Browser → Traefik
           ├── /       → web (Next.js, port 3000)
           └── /api/*  → api (Hono, port 3001)
           └── /mcp/*  → api (Hono, port 3001)

web (server components) ──HTTP──▶ api
web (client components) ──WS────▶ api  (real-time)
LLM client              ──SSE───▶ api /mcp  (Bearer token)
```

- `apps/api` owns all domain logic, DB access, and business rules. Drizzle schema types never leave this package.
- `apps/web` is the BFF: server components fetch from the API and map to view models before rendering. Raw API shapes never reach the browser.
- `packages/shared` contains only DTO interfaces and enums agreed on by both sides.

---

## 4. Domain Model (DDD)

### Bounded Contexts

| Context | Entities / Value Objects |
|---|---|
| Identity | User, Session, ApiKey, InvitationToken |
| Organization | Organization, Membership, Role |
| Project | Project, Column |
| Board | Task, TaskTag, TaskLink, TaskWatcher, TaskAdvisor, TaskHistory |

### Identity

- `User` — id, email, passwordHash, displayName, createdAt
- `Session` — stateless JWT (access token); refresh token stored hashed in DB
- `ApiKey` — id, userId, hashedKey, label, createdAt, lastUsedAt
- `InvitationToken` — id, organizationId, createdBy, hashedToken, expiresAt, usedAt?

### Organization

- `Organization` — id, name, website?, createdAt
- `Membership` — userId, organizationId, role (`owner` | `manager` | `member`)

### Project

- `Project` — id, organizationId, name, createdAt

### Board

- `Task` — id, projectId, column (`ideas`|`todo`|`doing`|`done`), title, description?, objective?, startDate, endDate, backgroundColor?, globalSubject?, reporterId, doerId?, validatorId?, position (decimal, fractional indexing for drag-and-drop reordering within a column), createdAt, updatedAt
- `TaskTag` — taskId, tag
- `TaskLink` — taskId, linkedTaskId (self-referential, undirected)
- `TaskWatcher` — taskId, userId
- `TaskAdvisor` — taskId, userId
- `TaskHistory` — id, taskId, userId, field, oldValue, newValue, changedAt, batchId?

### Invariants

- A `User` must always belong to at least one `Organization`.
- Only one `owner` per `Organization`. Owner cannot leave — must transfer first.
- An `Organization` cannot be deleted if it is the owner's only org (regardless of member count).
- `Task.doerId` is optional at creation. Moving a task to `doing` requires a doer. Moving back to `todo` or `ideas` clears `doerId` and writes a history event.
- Reporter, Doer, Validator, Watchers, and Advisors must all be members of the task's organization.
- `TaskHistory` is append-only.
- Adding or removing a `TaskWatcher` or `TaskAdvisor` writes a history record.
- Tasks are created in `ideas` or `todo` only — never directly in `doing` or `done`.

### Role Hierarchy

```
owner > manager > member
```

| Action | member | manager | owner |
|---|---|---|---|
| Create project | ✓ | ✓ | ✓ |
| Delete project | ✗ | ✓ | ✓ |
| Create / edit task | ✓ | ✓ | ✓ |
| Manage members | ✗ | ✓ | ✓ |
| Transfer ownership | ✗ | ✗ | ✓ |
| Delete organization | ✗ | ✗ | ✓ |

---

## 5. Authentication & Authorization

### Authentication (authn)

- **Passwords** hashed with `argon2`.
- **Access token** — short-lived JWT (15 min), payload `{ sub: userId, sessionId }`.
- **Refresh token** — long-lived (7 days), httpOnly cookie, rotated on each use, stored hashed in DB.
- **Register** → creates User + prompts org creation, unless arriving via invitation token.
- **Invitation flow** → token in URL → registration skips org creation, auto-joins org as `member`, token marked used.

### Authorization (authz)

Fully separate middleware layer in Hono, never mixed with authn.

```
Request
  → AuthnMiddleware   (validates JWT, attaches req.user)
  → AuthzMiddleware   (resolves membership + role for target resource)
  → Route handler
```

Role checks are always resource-scoped and always hit the DB. A user may hold different roles across organizations.

### MCP API Keys

- Users generate named API keys in their profile settings.
- Raw key shown once on creation, never stored — only a bcrypt hash is kept.
- Requests to `/mcp/*` authenticate via `Authorization: Bearer <key>`.
- `lastUsedAt` tracked for auditing; keys can be revoked individually.
- Rate-limited per key (100 req/min).

---

## 6. Real-time (WebSockets)

### Connection

- Client opens one WS connection per session, authenticated via `?token=<accessToken>` on upgrade.
- Server resolves memberships and auto-subscribes to all user's org rooms.
- Client sends `{ type: "subscribe", room: "project:{projectId}" }` when opening a board.

### Rooms

- `org:{orgId}` — membership and project events
- `project:{projectId}` — task events

### Event Envelope

```typescript
{ type: string, payload: unknown, actorId: string, timestamp: string }
```

### Events

| Event | Room | Trigger |
|---|---|---|
| `task.created` | project | new task |
| `task.updated` | project | field auto-save |
| `task.moved` | project | column change |
| `task.deleted` | project | deletion |
| `task.history` | project | any history entry written |
| `member.joined` | org | invitation accepted |
| `member.removed` | org | manager or owner removes member |
| `project.created` | org | new project |
| `project.deleted` | org | project deleted |

### Client Behavior

- WS events update TanStack Query cache directly — no redundant HTTP refetch.
- Incoming `task.updated` events do not overwrite a field the current user is actively editing (detected via focus state).
- Reconnect on disconnect with exponential backoff (max 30s).

### Broadcast Flow

All mutations (HTTP or MCP) go through the same domain service layer → DB write → WS broadcast to room. Real-time is guaranteed regardless of mutation source.

---

## 7. MCP Server

### Transport

SSE transport via `@modelcontextprotocol/sdk`.

```
GET  /mcp/sse      — server-sent event stream (server → client)
POST /mcp/message  — client messages (client → server)
```

### Client Configuration

```json
{
  "mcpServers": {
    "kanban": {
      "url": "https://yourdomain.com/mcp/sse",
      "headers": { "Authorization": "Bearer <apiKey>" }
    }
  }
}
```

### Tools

**Organization**
- `list_organizations`
- `create_organization` — name, website?

**Project**
- `list_projects` — orgId
- `create_project` — orgId, name

**Task**
- `list_tasks` — projectId, filters: column?, tag?, doerId?
- `create_task` — all fields except doer; column defaults to `todo`
- `update_task` — any fields; all changes share a `batchId` for history grouping
- `move_task` — taskId, targetColumn (enforces doer requirement for `doing`)
- `delete_task` — manager/owner only

**Resources**
- `kanban://projects/{projectId}/board` — full board state as structured text

### Security

- Bearer key resolved to a `User` before any tool executes.
- Responses use shared DTOs — no DB schema types exposed.
- Same authz middleware as HTTP routes — MCP cannot exceed the user's permissions.
- All mutations trigger WS broadcast.

---

## 8. Frontend / UI

### Layout

```
┌───────────────────────────────────────────────────────┐
│ Topbar: logo, current org, user menu                  │
├────────────┬──────────────────────────────────────────┤
│ Left       │ Main area          │ Task detail sidebar │
│ Sidebar    │                    │ (slides in on click)│
│            │  Board / Settings  │                     │
│ Org        │                    │                     │
│ └ Proj A   │                    │                     │
│ └ Proj B   │                    │                     │
│ + New proj │                    │                     │
└────────────┴────────────────────┴─────────────────────┘
```

### Board

- Four columns: **Ideas** (collapsed by default, toggle via chevron), **TODO**, **Doing**, **Done**.
- Cards draggable between columns via `@dnd-kit/core`.
- Card shows: title, tag chips, doer avatar, due date (red if overdue), background color.
- `+ New Task` at bottom of each column (Ideas shows it when expanded).
- Columns scroll independently; board scrolls horizontally.

### New Task Modal

Fields:
- Title (required)
- Description (markdown, optional)
- Objective (optional)
- Target column — `ideas` or `todo` (pre-filled from clicked column's `+` button)
- Tags (free-form chips)
- Start date (pre-filled: today), End date (pre-filled: today + 2 days)
- Reporter (auto-filled: current user, changeable)
- Background color (optional color picker)

No Doer field — assigned later when task is moved to Doing.

### Task Detail Sidebar

Opens on card click; board remains interactive. Auto-saves each field on blur/change.

- **Header**: inline-editable title, background color, column badge
- **People**: Reporter, Doer (required to move to Doing), Validator, Watchers, Advisors — all searchable user pickers
- **Details**: markdown description, objective, dates, tags, global subject, linked tasks
- **History**: chronological feed — each entry shows field, old→new value, actor, timestamp. MCP batch changes (`batchId`) grouped as a single expandable row labeled "Updated via MCP by [user]".

### Drag Behavior

Dropping a card onto `doing` with no Doer assigned prompts the user to assign one before confirming the move.

### Routing

```
/                          → redirect to first org/project
/onboarding                → post-register org creation
/invite/[token]            → invitation acceptance flow
/[orgSlug]/[projectSlug]   → board view
/[orgSlug]/settings        → org settings (members, invitations, danger zone)
/profile                   → user profile + MCP API key management
```

---

## 9. CSV Import

### Template Columns

```
title,description,objective,start_date,end_date,tags,global_subject,background_color,reporter_email,validator_email,column
```

### Rules

- `title` — required.
- `start_date` / `end_date` — ISO 8601 (`YYYY-MM-DD`); default to today / today+2 if blank.
- `tags` — pipe-separated (`bug|frontend`).
- `column` — `ideas` or `todo` only; defaults to `todo` if blank.
- `reporter_email` — must be an org member; defaults to importing user if blank.
- `validator_email` — optional; must be an org member if provided.
- `background_color` — hex string (`#f97316`), optional.

### Flow

File picker → server parses + validates all rows → preview table with row-level errors highlighted → user confirms → valid rows inserted in one DB transaction → import report returned (rows imported, rows skipped with reasons).

---

## 10. Docker & Deployment

### docker-compose.yml (simplified)

```yaml
services:
  api:
    build: ./apps/api
    environment:
      - DATABASE_URL=file:/data/kanban.db
      - JWT_SECRET
      - REFRESH_SECRET
    volumes:
      - sqlite_data:/data
    labels:
      - "traefik.http.routers.api.rule=Host(`yourdomain.com`) && PathPrefix(`/api`,`/mcp`)"

  web:
    build: ./apps/web
    environment:
      - NEXT_PUBLIC_API_URL=https://yourdomain.com
    labels:
      - "traefik.http.routers.web.rule=Host(`yourdomain.com`)"

volumes:
  sqlite_data:
```

### SQLite → PostgreSQL Migration

1. Change `DATABASE_URL` to a PostgreSQL connection string.
2. Swap Drizzle driver from `better-sqlite3` to `postgres-js`.
3. Re-run migrations.

Zero application code changes required — Drizzle abstracts the dialect.

### WebSocket + Traefik

Traefik passes WebSocket upgrades through automatically. No additional config needed beyond standard routing labels.

---

## 11. Technology Stack Summary

| Concern | Choice |
|---|---|
| API framework | Hono (TypeScript) |
| Frontend | Next.js 14 App Router |
| ORM | Drizzle ORM |
| Database (dev) | SQLite via `better-sqlite3` |
| Database (prod) | PostgreSQL (driver swap only) |
| Auth tokens | `jose` (JWT) |
| Password hashing | `argon2` |
| Real-time | WebSockets (`ws` + Hono WS helper) |
| MCP server | `@modelcontextprotocol/sdk` |
| Drag and drop | `@dnd-kit/core` |
| UI components | shadcn/ui + Tailwind CSS |
| Client state | Zustand |
| Server state / cache | TanStack Query |
| Monorepo | pnpm workspaces + Turborepo |
| Linting | ESLint (typescript-eslint) + Prettier |
| Containers | Docker Compose + Traefik |
