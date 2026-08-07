# Project Archiving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organization archive a project as a reversible alternative to deletion, hiding it from the main lists while keeping it fully usable, and reflect the state on the wiki.

**Architecture:** A nullable `archived_at` column on `projects` mirrors the existing `tasks.archived_at` pattern. Two new service methods (`archiveProject` / `restoreProject`) toggle it, broadcast `project.updated`, and re-sync the organization wiki index, which grows an `### Archived` section derived from the database. The project's knowledge-base wiki page gets a marker-delimited `<details>` notice inserted on archive and stripped on restore. The web layer receives every project (active + archived) and splits them client-side into main lists plus collapsible "Archived" sections.

**Tech Stack:** Hono + Drizzle ORM (better-sqlite3) on the API, Vitest for tests, Next.js 14 App Router + Tailwind on the web, MCP SDK for tools.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-07-project-archiving-design.md`.
- Archiving is classification only — no read-only guards anywhere. An archived project stays fully editable.
- `ProjectService.listProjects` keeps returning **all** projects; no `includeArchived` parameter.
- Drizzle `.returning().get()` is the required shape for single-row writes (never array destructuring).
- Date format for all user-visible wiki dates: `YYYY-MM-DD`.
- Wiki markers, exact strings: `<!-- kanban:project-archived:start -->` and `<!-- kanban:project-archived:end -->`.
- Existing markers `<!-- kanban:auto-project-index:start -->` / `:end` must keep working unchanged.
- Run from repo root: `pnpm --filter @kanban/api test`, `pnpm lint`, `pnpm build`.
- Commit after every task.

---

### Task 1: `archivedAt` on the schema and the DTO

**Files:**

- Modify: `apps/api/src/db/schema/project.ts`
- Modify: `packages/shared/src/dtos/project.ts`
- Modify: `apps/api/src/features/project/project.service.ts:13-20` (`toDto`)
- Create: `apps/api/drizzle/migrations/00XX_*.sql` (generated)
- Test: `apps/api/src/tests/features/project.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `ProjectDto.archivedAt: string | null`; `projects.archivedAt` column (`archived_at`, nullable text).

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/tests/features/project.test.ts` (the file already defines `setup()` and `auth()` helpers at the top — reuse them):

```ts
describe("project archivedAt field", () => {
  it("returns archivedAt: null for a freshly created project", async () => {
    const { app, accessToken, orgId, close } = await setup();
    const res = await app.request(`/organizations/${orgId}/projects`, {
      method: "POST",
      headers: { ...auth(accessToken), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sprint 1" }),
    });
    const body = (await res.json()) as { archivedAt: string | null };
    expect(body.archivedAt).toBeNull();
    close();
  });

  it("exposes archivedAt on the list endpoint", async () => {
    const { app, accessToken, orgId, close } = await setup();
    await app.request(`/organizations/${orgId}/projects`, {
      method: "POST",
      headers: { ...auth(accessToken), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sprint 1" }),
    });
    const res = await app.request(`/organizations/${orgId}/projects`, {
      headers: auth(accessToken),
    });
    const body = (await res.json()) as Array<{ archivedAt: string | null }>;
    expect(body[0]).toHaveProperty("archivedAt", null);
    close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kanban/api test project.test`
Expected: FAIL — `archivedAt` is `undefined`, not `null`.

- [ ] **Step 3: Add the column**

In `apps/api/src/db/schema/project.ts`, add the field after `name`:

```ts
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  archivedAt: text("archived_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
```

- [ ] **Step 4: Add the DTO field**

`packages/shared/src/dtos/project.ts`:

```ts
export interface ProjectDto {
  id: string;
  organizationId: string;
  name: string;
  archivedAt: string | null;
  createdAt: string;
}
```

- [ ] **Step 5: Map it in `toDto`**

`apps/api/src/features/project/project.service.ts`:

```ts
function toDto(row: typeof projects.$inferSelect): ProjectDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    archivedAt: row.archivedAt ?? null,
    createdAt: row.createdAt,
  };
}
```

- [ ] **Step 6: Generate the migration**

Run: `cd apps/api && pnpm drizzle-kit generate`
Expected: a new `apps/api/drizzle/migrations/00XX_<name>.sql` containing
`ALTER TABLE \`projects\` ADD \`archived_at\` text;`plus an updated snapshot in`meta/`.
Open the generated `.sql`and confirm it contains only that ALTER — nothing that drops or
recreates a table. If it tries to recreate`projects`, stop and report.

- [ ] **Step 7: Run tests and type check**

Run: `pnpm --filter @kanban/api test project.test`
Expected: PASS

Run: `pnpm build`
Expected: PASS. If any other file constructs a `ProjectDto` literal, TypeScript will now
flag the missing `archivedAt` — add `archivedAt: null` (or the row value) there.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/db/schema/project.ts packages/shared/src/dtos/project.ts \
  apps/api/src/features/project/project.service.ts apps/api/drizzle/migrations \
  apps/api/src/tests/features/project.test.ts
git commit -m "feat(project): add archivedAt column and DTO field"
```

---

### Task 2: `archiveProject` / `restoreProject` service methods and routes

**Files:**

- Modify: `apps/api/src/features/project/project.service.ts`
- Modify: `apps/api/src/features/project/project.routes.ts`
- Test: `apps/api/src/tests/features/project-archive.test.ts` (create)

**Interfaces:**

- Consumes: `ProjectDto.archivedAt` and `projects.archivedAt` from Task 1.
- Produces:
  - `ProjectService.archiveProject(orgId: string, projectId: string, userId?: string): ProjectDto`
  - `ProjectService.restoreProject(orgId: string, projectId: string, userId?: string): ProjectDto`
  - `POST /organizations/:orgId/projects/:projectId/archive` → `ProjectDto`
  - `POST /organizations/:orgId/projects/:projectId/restore` → `ProjectDto`
  - Both routes require the `manager` org role, like DELETE.

Wiki syncing is deliberately **not** part of this task; Task 3 wires it in.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/tests/features/project-archive.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, loginTestUser } from "../../db/test-utils.js";
import { createApp } from "../../app.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function setup() {
  const testDb = createTestDb();
  const app = createApp(testDb.db);
  const { accessToken } = await loginTestUser(app, testDb.db, {
    email: "alice@example.com",
    password: "password123",
    displayName: "Alice",
  });
  const orgRes = await app.request("/organizations", {
    method: "POST",
    headers: { ...auth(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Alice Org" }),
  });
  const org = (await orgRes.json()) as { id: string };
  const projectRes = await app.request(`/organizations/${org.id}/projects`, {
    method: "POST",
    headers: { ...auth(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Sprint" }),
  });
  const project = (await projectRes.json()) as { id: string };
  return {
    app,
    db: testDb.db,
    accessToken,
    orgId: org.id,
    projectId: project.id,
    close: testDb.close,
  };
}

function archive(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  projectId: string,
) {
  return app.request(`/organizations/${orgId}/projects/${projectId}/archive`, {
    method: "POST",
    headers: auth(token),
  });
}

function restore(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  projectId: string,
) {
  return app.request(`/organizations/${orgId}/projects/${projectId}/restore`, {
    method: "POST",
    headers: auth(token),
  });
}

describe("POST /organizations/:orgId/projects/:projectId/archive", () => {
  it("sets archivedAt and returns the updated project", async () => {
    const { app, accessToken, orgId, projectId, close } = await setup();
    const res = await archive(app, accessToken, orgId, projectId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      archivedAt: string | null;
    };
    expect(body.id).toBe(projectId);
    expect(body.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    close();
  });

  it("keeps the project in the list endpoint", async () => {
    const { app, accessToken, orgId, projectId, close } = await setup();
    await archive(app, accessToken, orgId, projectId);
    const res = await app.request(`/organizations/${orgId}/projects`, {
      headers: auth(accessToken),
    });
    const body = (await res.json()) as Array<{
      id: string;
      archivedAt: string | null;
    }>;
    expect(body).toHaveLength(1);
    expect(body[0]?.archivedAt).not.toBeNull();
    close();
  });

  it("rejects archiving twice with 422", async () => {
    const { app, accessToken, orgId, projectId, close } = await setup();
    await archive(app, accessToken, orgId, projectId);
    const res = await archive(app, accessToken, orgId, projectId);
    expect(res.status).toBe(422);
    close();
  });

  it("returns 404 for an unknown project", async () => {
    const { app, accessToken, orgId, close } = await setup();
    const res = await archive(app, accessToken, orgId, "does-not-exist");
    expect(res.status).toBe(404);
    close();
  });
});

describe("POST /organizations/:orgId/projects/:projectId/restore", () => {
  it("clears archivedAt", async () => {
    const { app, accessToken, orgId, projectId, close } = await setup();
    await archive(app, accessToken, orgId, projectId);
    const res = await restore(app, accessToken, orgId, projectId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { archivedAt: string | null };
    expect(body.archivedAt).toBeNull();
    close();
  });

  it("rejects restoring an active project with 422", async () => {
    const { app, accessToken, orgId, projectId, close } = await setup();
    const res = await restore(app, accessToken, orgId, projectId);
    expect(res.status).toBe(422);
    close();
  });

  it("returns 404 for an unknown project", async () => {
    const { app, accessToken, orgId, close } = await setup();
    const res = await restore(app, accessToken, orgId, "does-not-exist");
    expect(res.status).toBe(404);
    close();
  });
});

describe("deleting an archived project", () => {
  it("still succeeds", async () => {
    const { app, accessToken, orgId, projectId, close } = await setup();
    await archive(app, accessToken, orgId, projectId);
    const res = await app.request(
      `/organizations/${orgId}/projects/${projectId}`,
      { method: "DELETE", headers: auth(accessToken) },
    );
    expect(res.status).toBe(200);
    close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kanban/api test project-archive`
Expected: FAIL — the archive/restore routes 404 for every case.

- [ ] **Step 3: Add the service methods**

In `apps/api/src/features/project/project.service.ts`, import `unprocessable` alongside
`notFound` (`import { notFound, unprocessable } from "../../lib/errors.js";` — check the
exported name in `apps/api/src/lib/errors.ts` and use whatever helper produces a 422 there,
as used by `task-service/archive.ts`). Add below `updateProject`:

```ts
  archiveProject(orgId: string, projectId: string, userId?: string): ProjectDto {
    const existing = this.requireProject(orgId, projectId);
    if (existing.archivedAt) throw unprocessable("Project is already archived");
    const updated = this.db
      .update(projects)
      .set({ archivedAt: new Date().toISOString() })
      .where(eq(projects.id, projectId))
      .returning()
      .get();
    if (!updated) throw new Error("Failed to archive project");
    const dto = toDto(updated);
    this.broadcast(`org:${orgId}`, { type: "project.updated", payload: dto });
    return dto;
  }

  restoreProject(orgId: string, projectId: string, userId?: string): ProjectDto {
    const existing = this.requireProject(orgId, projectId);
    if (!existing.archivedAt) throw unprocessable("Project is not archived");
    const updated = this.db
      .update(projects)
      .set({ archivedAt: null })
      .where(eq(projects.id, projectId))
      .returning()
      .get();
    if (!updated) throw new Error("Failed to restore project");
    const dto = toDto(updated);
    this.broadcast(`org:${orgId}`, { type: "project.updated", payload: dto });
    return dto;
  }

  private requireProject(orgId: string, projectId: string) {
    const existing = this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();
    if (!existing) throw notFound("Project not found");
    if (existing.organizationId !== orgId) throw notFound("Project not found");
    return existing;
  }
```

The `userId` parameters are unused for now — Task 3 passes them to the wiki sync. If the
lint rule for unused parameters complains, keep the parameter and prefix nothing; the next
task consumes it. If lint blocks the commit, temporarily reference it via the wiki call
added in Task 3 by doing Task 3 immediately after.

Refactor `updateProject` and `deleteProject` to use `requireProject` instead of their
duplicated lookup blocks — same behavior, less duplication.

- [ ] **Step 4: Add the routes**

In `apps/api/src/features/project/project.routes.ts`, after the DELETE route:

```ts
router.post(
  "/:orgId/projects/:projectId/archive",
  authz.requireOrgRole("manager", (c) => c.req.param("orgId")),
  (c) =>
    c.json(
      svc.archiveProject(
        c.req.param("orgId"),
        c.req.param("projectId"),
        c.get("userId"),
      ),
    ),
);

router.post(
  "/:orgId/projects/:projectId/restore",
  authz.requireOrgRole("manager", (c) => c.req.param("orgId")),
  (c) =>
    c.json(
      svc.restoreProject(
        c.req.param("orgId"),
        c.req.param("projectId"),
        c.get("userId"),
      ),
    ),
);
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @kanban/api test project-archive`
Expected: PASS (all 8 tests)

Run: `pnpm --filter @kanban/api test`
Expected: PASS — no regressions.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/features/project apps/api/src/tests/features/project-archive.test.ts
git commit -m "feat(project): add archive and restore endpoints"
```

---

### Task 3: Wiki sync — `### Archived` index section and the KB `<details>` notice

**Files:**

- Modify: `apps/api/src/features/wiki/wiki-service/project-index.ts`
- Modify: `apps/api/src/features/project/project.service.ts` (call the sync functions)
- Test: `apps/api/src/tests/features/wiki-project-archive.test.ts` (create)

**Interfaces:**

- Consumes: `archiveProject` / `restoreProject` from Task 2; existing `syncOrganizationIndex`,
  `findProjectKnowledgeBase`, `updateTrackedWikiPage`, `formatDeletedAt` in `project-index.ts`.
- Produces:
  - `syncOrganizationIndexForProjectArchived(ctx: WikiServiceContext, orgId: string, project: { id: string; name: string }, userId?: string): WikiPageDto`
  - `syncOrganizationIndexForProjectRestored(ctx: WikiServiceContext, orgId: string, project: { id: string; name: string }, userId?: string): WikiPageDto`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/tests/features/wiki-project-archive.test.ts`. Model the setup on
`apps/api/src/tests/features/wiki.service.test.ts` (read it first to copy how it builds a
`WikiService` / context and how it locates pages).

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, loginTestUser } from "../../db/test-utils.js";
import { createApp } from "../../app.js";
import { ProjectService } from "../../features/project/project.service.js";
import { wikiPages } from "../../db/schema/wiki.js";
import { and, eq } from "drizzle-orm";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

async function setup() {
  const testDb = createTestDb();
  const app = createApp(testDb.db);
  const { accessToken, userId } = await loginTestUser(app, testDb.db, {
    email: "alice@example.com",
    password: "password123",
    displayName: "Alice",
  });
  const orgRes = await app.request("/organizations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Alice Org" }),
  });
  const org = (await orgRes.json()) as { id: string };
  const svc = new ProjectService(testDb.db);
  const project = svc.createProject(org.id, { name: "Sprint" }, userId);
  return {
    db: testDb.db,
    svc,
    orgId: org.id,
    project,
    userId,
    close: testDb.close,
  };
}

function rootContent(db: ReturnType<typeof createTestDb>["db"], orgId: string) {
  const page = db
    .select()
    .from(wikiPages)
    .where(and(eq(wikiPages.organizationId, orgId), eq(wikiPages.slug, "root")))
    .get();
  return page?.content ?? "";
}

function kbContent(
  db: ReturnType<typeof createTestDb>["db"],
  orgId: string,
  projectId: string,
) {
  const page = db
    .select()
    .from(wikiPages)
    .where(
      and(
        eq(wikiPages.organizationId, orgId),
        eq(wikiPages.projectId, projectId),
      ),
    )
    .get();
  return page?.content ?? "";
}

describe("organization index on project archive", () => {
  it("moves the project from Active to Archived", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    expect(rootContent(db, orgId)).toContain("### Active");
    svc.archiveProject(orgId, project.id, userId);
    const content = rootContent(db, orgId);
    expect(content).toContain("### Archived");
    const archivedSection = content.slice(content.indexOf("### Archived"));
    expect(archivedSection).toContain("**Sprint**");
    expect(archivedSection).toMatch(/archived on \d{4}-\d{2}-\d{2}/);
    expect(archivedSection).toContain(
      `[Board](/orgs/${orgId}/projects/${project.id})`,
    );
    expect(archivedSection).toContain("[Knowledge Base]");
    const activeSection = content.slice(
      content.indexOf("### Active"),
      content.indexOf("### Archived"),
    );
    expect(activeSection).toContain("No active projects.");
    close();
  });

  it("moves the project back to Active on restore and drops the section", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    svc.archiveProject(orgId, project.id, userId);
    svc.restoreProject(orgId, project.id, userId);
    const content = rootContent(db, orgId);
    expect(content).not.toContain("### Archived");
    expect(content).toContain("**Sprint**");
    close();
  });
});

describe("knowledge base archive notice", () => {
  it("prepends a details block with the archive date", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    svc.archiveProject(orgId, project.id, userId);
    const content = kbContent(db, orgId, project.id);
    expect(content.startsWith("<!-- kanban:project-archived:start -->")).toBe(
      true,
    );
    expect(content).toContain("<details>");
    expect(content).toContain("Archived project");
    expect(content).toMatch(/archived on \d{4}-\d{2}-\d{2}/);
    expect(content).toContain("<!-- kanban:project-archived:end -->");
    expect(content).toContain("Documentation for project Sprint starts here.");
    close();
  });

  it("does not stack the block when archive runs twice", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    svc.archiveProject(orgId, project.id, userId);
    svc.restoreProject(orgId, project.id, userId);
    svc.archiveProject(orgId, project.id, userId);
    const content = kbContent(db, orgId, project.id);
    expect(
      content.split("<!-- kanban:project-archived:start -->"),
    ).toHaveLength(2);
    close();
  });

  it("removes the block on restore", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    svc.archiveProject(orgId, project.id, userId);
    svc.restoreProject(orgId, project.id, userId);
    const content = kbContent(db, orgId, project.id);
    expect(content).not.toContain("kanban:project-archived");
    expect(content.startsWith("# KB: Sprint")).toBe(true);
    close();
  });

  it("keeps user content when restoring a page that never had the block", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    const before = kbContent(db, orgId, project.id);
    svc.archiveProject(orgId, project.id, userId);
    svc.restoreProject(orgId, project.id, userId);
    expect(kbContent(db, orgId, project.id)).toBe(before);
    close();
  });
});

describe("deleting an archived project", () => {
  it("still records a Deleted entry", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    svc.archiveProject(orgId, project.id, userId);
    svc.deleteProject(orgId, project.id, userId);
    const content = rootContent(db, orgId);
    expect(content).toContain("### Deleted");
    expect(content).toMatch(/\*\*Sprint\*\*: deleted on \d{4}-\d{2}-\d{2}/);
    expect(content).not.toContain("### Archived");
    close();
  });
});
```

If `loginTestUser` does not return `userId`, read `apps/api/src/db/test-utils.ts` and use
whatever it exposes (e.g. call `/auth/me` with the token) to obtain the actor id.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kanban/api test wiki-project-archive`
Expected: FAIL — no `### Archived` section, no notice block.

- [ ] **Step 3: Add archived-project support to `project-index.ts`**

Add the marker constants next to the existing ones at the top of the file:

```ts
const ARCHIVED_NOTICE_START = "<!-- kanban:project-archived:start -->";
const ARCHIVED_NOTICE_END = "<!-- kanban:project-archived:end -->";
```

Widen the row type and add the archived listing:

```ts
type ProjectIndexRow = Pick<typeof projects.$inferSelect, "id" | "name">;
type ArchivedProjectRow = ProjectIndexRow & { archivedAt: string };
```

```ts
function listActiveProjects(
  ctx: WikiServiceContext,
  orgId: string,
  excludeProjectId?: string,
): ProjectIndexRow[] {
  return ctx.db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.organizationId, orgId), isNull(projects.archivedAt)))
    .all()
    .filter((project) => project.id !== excludeProjectId)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function listArchivedProjects(
  ctx: WikiServiceContext,
  orgId: string,
  excludeProjectId?: string,
): ArchivedProjectRow[] {
  return ctx.db
    .select({
      id: projects.id,
      name: projects.name,
      archivedAt: projects.archivedAt,
    })
    .from(projects)
    .where(
      and(eq(projects.organizationId, orgId), isNotNull(projects.archivedAt)),
    )
    .all()
    .filter((project) => project.id !== excludeProjectId)
    .map((project) => ({ ...project, archivedAt: project.archivedAt ?? "" }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
```

Import `isNull` and `isNotNull` from `drizzle-orm` alongside `and` and `eq`.

- [ ] **Step 4: Render the `### Archived` section**

In `syncOrganizationIndex`, fetch the archived rows and pass them through:

```ts
const liveProjects = listActiveProjects(ctx, orgId, options.excludeProjectId);
const archivedProjects = listArchivedProjects(
  ctx,
  orgId,
  options.excludeProjectId,
);
const deletedProjects = mergeDeletedProjectEntries(
  extractDeletedProjectEntries(rootPage.content),
  options.deletedProject,
);
const content = upsertAutomatedIndexBlock(
  rootPage.content,
  buildAutomatedIndexBlock(
    ctx,
    orgId,
    actorId,
    rootPage.id,
    liveProjects,
    archivedProjects,
    deletedProjects,
  ),
);
```

In `buildAutomatedIndexBlock`, add the `archivedProjects: ArchivedProjectRow[]` parameter
between `activeProjects` and `deletedProjects`, and insert this block after the Active
section and before the Deleted section:

```ts
if (archivedProjects.length > 0) {
  lines.push("", "### Archived", "");
  for (const project of archivedProjects) {
    const pageId = findOrCreateProjectKnowledgeBase(
      ctx,
      orgId,
      userId,
      rootPageId,
      project,
    ).id;
    lines.push(
      `- **${escapeMarkdownText(project.name)}**: archived on ${formatDeletedAt(new Date(project.archivedAt))} | [Board](/orgs/${orgId}/projects/${project.id}) | [Knowledge Base](/orgs/${orgId}/projects/${project.id}/wiki/${pageId})`,
    );
  }
}
```

- [ ] **Step 5: Add the notice helpers and the two exported sync functions**

```ts
export function syncOrganizationIndexForProjectArchived(
  ctx: WikiServiceContext,
  orgId: string,
  project: ProjectIndexRow,
  userId?: string,
  archivedAt = new Date(),
): WikiPageDto {
  const actorId = resolveIndexUserId(ctx, orgId, userId);
  // Sync first: it creates the knowledge base page when it does not exist yet.
  const indexPage = syncOrganizationIndex(ctx, orgId, actorId);
  const rootPage = findOrCreateOrganizationIndexPage(ctx, orgId, actorId);
  const kbPage = findProjectKnowledgeBase(ctx, orgId, project.id, rootPage.id);
  if (kbPage) {
    upsertArchivedNotice(ctx, kbPage, actorId, formatDeletedAt(archivedAt));
  }
  return indexPage;
}

export function syncOrganizationIndexForProjectRestored(
  ctx: WikiServiceContext,
  orgId: string,
  project: ProjectIndexRow,
  userId?: string,
): WikiPageDto {
  const actorId = resolveIndexUserId(ctx, orgId, userId);
  const rootPage = findOrCreateOrganizationIndexPage(ctx, orgId, actorId);
  const kbPage = findProjectKnowledgeBase(ctx, orgId, project.id, rootPage.id);
  if (kbPage) removeArchivedNotice(ctx, kbPage, actorId);
  return syncOrganizationIndex(ctx, orgId, actorId);
}

function buildArchivedNotice(archivedOn: string): string {
  return [
    ARCHIVED_NOTICE_START,
    "<details>",
    "<summary>⚠️ Archived project</summary>",
    "",
    `This project was archived on ${archivedOn}.`,
    "",
    "</details>",
    ARCHIVED_NOTICE_END,
  ].join("\n");
}

function upsertArchivedNotice(
  ctx: WikiServiceContext,
  page: WikiPageRow,
  userId: string,
  archivedOn: string,
): WikiPageDto {
  const notice = buildArchivedNotice(archivedOn);
  const stripped = stripArchivedNotice(page.content);
  const content = stripped ? `${notice}\n\n${stripped}` : notice;
  if (content === page.content) return toWikiPageDto(page);
  return updateTrackedWikiPage(ctx, page, userId, { content });
}

function removeArchivedNotice(
  ctx: WikiServiceContext,
  page: WikiPageRow,
  userId: string,
): WikiPageDto {
  const content = stripArchivedNotice(page.content);
  if (content === page.content) return toWikiPageDto(page);
  return updateTrackedWikiPage(ctx, page, userId, { content });
}

function stripArchivedNotice(content: string): string {
  const start = content.indexOf(ARCHIVED_NOTICE_START);
  const end = content.indexOf(ARCHIVED_NOTICE_END);
  if (start === -1 || end === -1 || end < start) return content;
  return `${content.slice(0, start)}${content.slice(end + ARCHIVED_NOTICE_END.length)}`.trim();
}
```

- [ ] **Step 6: Call the sync functions from the service**

In `apps/api/src/features/project/project.service.ts`, extend the wiki import:

```ts
import {
  syncOrganizationIndexForProjectArchived,
  syncOrganizationIndexForProjectCreated,
  syncOrganizationIndexForProjectDeleted,
  syncOrganizationIndexForProjectRestored,
} from "../wiki/wiki-service/project-index.js";
```

At the end of `archiveProject`, before `return dto;`:

```ts
syncOrganizationIndexForProjectArchived(
  { db: this.db, broadcast: this.broadcast },
  orgId,
  { id: updated.id, name: updated.name },
  userId,
);
```

And in `restoreProject`, before `return dto;`:

```ts
syncOrganizationIndexForProjectRestored(
  { db: this.db, broadcast: this.broadcast },
  orgId,
  { id: updated.id, name: updated.name },
  userId,
);
```

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @kanban/api test wiki-project-archive`
Expected: PASS

Run: `pnpm --filter @kanban/api test`
Expected: PASS. `wiki.service.test.ts` exercises the index block — if an assertion there
breaks because of the new section ordering, fix the assertion only if the new output is
correct per the spec (Active → Archived → Deleted); never weaken a correct assertion.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/features/wiki/wiki-service/project-index.ts \
  apps/api/src/features/project/project.service.ts \
  apps/api/src/tests/features/wiki-project-archive.test.ts
git commit -m "feat(wiki): reflect project archiving in index and KB page"
```

---

### Task 4: MCP `archive_project` / `restore_project`

**Files:**

- Modify: `apps/api/src/features/mcp/mcp-server/project-tools.ts`
- Test: `apps/api/src/tests/features/mcp-project-tools.test.ts` (create)

**Interfaces:**

- Consumes: `ProjectService.archiveProject` / `restoreProject` from Task 2.
- Produces: MCP tools `archive_project` and `restore_project`, both with input
  `{ orgId: string, projectId: string }`, returning the updated project as JSON text.
  `list_projects` output gains `archived: true` on archived projects.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/tests/features/mcp-project-tools.test.ts`. Read
`apps/api/src/tests/features/mcp-organization-tools.test.ts` first and copy its harness
(how it registers tools against a fake/real `McpServer` and invokes a handler).

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, loginTestUser } from "../../db/test-utils.js";
import { createApp } from "../../app.js";
import { ProjectService } from "../../features/project/project.service.js";
import { registerProjectTools } from "../../features/mcp/mcp-server/project-tools.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

type Handler = (input: Record<string, unknown>) => {
  content: Array<{ text: string }>;
};

function collectTools() {
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _config: unknown, handler: Handler) => {
      handlers.set(name, handler);
    },
  };
  return { server, handlers };
}

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0]?.text ?? "null");
}

async function setup() {
  const testDb = createTestDb();
  const app = createApp(testDb.db);
  const { accessToken, userId } = await loginTestUser(app, testDb.db, {
    email: "alice@example.com",
    password: "password123",
    displayName: "Alice",
  });
  const orgRes = await app.request("/organizations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Alice Org" }),
  });
  const org = (await orgRes.json()) as { id: string };
  const svc = new ProjectService(testDb.db);
  const project = svc.createProject(org.id, { name: "Sprint" }, userId);
  const { server, handlers } = collectTools();
  registerProjectTools(server as never, svc, userId);
  return { handlers, orgId: org.id, project, close: testDb.close };
}

describe("archive_project / restore_project MCP tools", () => {
  it("archives a project", async () => {
    const { handlers, orgId, project, close } = await setup();
    const result = parse(
      handlers.get("archive_project")!({ orgId, projectId: project.id }),
    );
    expect(result.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    close();
  });

  it("flags archived projects in list_projects", async () => {
    const { handlers, orgId, project, close } = await setup();
    handlers.get("archive_project")!({ orgId, projectId: project.id });
    const list = parse(handlers.get("list_projects")!({ orgId })) as Array<{
      id: string;
      archived?: boolean;
    }>;
    expect(list.find((p) => p.id === project.id)?.archived).toBe(true);
    close();
  });

  it("does not flag active projects", async () => {
    const { handlers, orgId, project, close } = await setup();
    const list = parse(handlers.get("list_projects")!({ orgId })) as Array<{
      id: string;
      archived?: boolean;
    }>;
    expect(list.find((p) => p.id === project.id)?.archived).toBeUndefined();
    close();
  });

  it("restores an archived project", async () => {
    const { handlers, orgId, project, close } = await setup();
    handlers.get("archive_project")!({ orgId, projectId: project.id });
    const result = parse(
      handlers.get("restore_project")!({ orgId, projectId: project.id }),
    );
    expect(result.archivedAt).toBeNull();
    close();
  });

  it("rejects archiving an already archived project", async () => {
    const { handlers, orgId, project, close } = await setup();
    handlers.get("archive_project")!({ orgId, projectId: project.id });
    expect(() =>
      handlers.get("archive_project")!({ orgId, projectId: project.id }),
    ).toThrow(/already archived/);
    close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kanban/api test mcp-project-tools`
Expected: FAIL — `handlers.get("archive_project")` is undefined.

- [ ] **Step 3: Register the tools**

In `apps/api/src/features/mcp/mcp-server/project-tools.ts`, replace the `list_projects`
handler and append the two new tools:

```ts
server.registerTool(
  "list_projects",
  {
    description:
      "List all projects in an organization. Archived projects are returned with an extra archived: true field.",
    inputSchema: { orgId: z.string().describe("Organization ID") },
  },
  ({ orgId }) =>
    jsonText(
      projectSvc
        .listProjects(orgId)
        .map((project) =>
          project.archivedAt ? { ...project, archived: true } : project,
        ),
    ),
);
```

```ts
server.registerTool(
  "archive_project",
  {
    description:
      "Archive a project. The project stays fully editable but is hidden from the main project lists and marked as archived on its knowledge base page.",
    inputSchema: {
      orgId: z.string().describe("Organization ID"),
      projectId: z.string().describe("Project ID"),
    },
  },
  ({ orgId, projectId }) =>
    jsonText(projectSvc.archiveProject(orgId, projectId, userId)),
);

server.registerTool(
  "restore_project",
  {
    description: "Restore an archived project back to active",
    inputSchema: {
      orgId: z.string().describe("Organization ID"),
      projectId: z.string().describe("Project ID"),
    },
  },
  ({ orgId, projectId }) =>
    jsonText(projectSvc.restoreProject(orgId, projectId, userId)),
);
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @kanban/api test mcp-project-tools`
Expected: PASS

Run: `pnpm --filter @kanban/api test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/features/mcp/mcp-server/project-tools.ts \
  apps/api/src/tests/features/mcp-project-tools.test.ts
git commit -m "feat(mcp): add archive_project and restore_project tools"
```

---

### Task 5: Web client and server actions

**Files:**

- Modify: `apps/web/src/lib/api/projects.ts`
- Modify: `apps/web/src/actions/projects.ts`

**Interfaces:**

- Consumes: the two API routes from Task 2.
- Produces:
  - `projectsApi.archive(token, orgId, projectId)` → `Promise<{ data: ProjectDto }>`
  - `projectsApi.restore(token, orgId, projectId)` → `Promise<{ data: ProjectDto }>`
  - `archiveProjectAction(orgId, projectId): Promise<{ error?: string; project?: ProjectDto }>`
  - `restoreProjectAction(orgId, projectId): Promise<{ error?: string; project?: ProjectDto }>`

`apps/web` has no test suite; verification here is `pnpm build` plus the manual check at the
end of Task 8.

- [ ] **Step 1: Add the API client methods**

In `apps/web/src/lib/api/projects.ts`, inside `projectsApi`:

```ts
  archive(token: string, orgId: string, projectId: string) {
    return apiFetch<ProjectDto>(
      `/organizations/${orgId}/projects/${projectId}/archive`,
      { method: "POST", token },
    );
  },
  restore(token: string, orgId: string, projectId: string) {
    return apiFetch<ProjectDto>(
      `/organizations/${orgId}/projects/${projectId}/restore`,
      { method: "POST", token },
    );
  },
```

- [ ] **Step 2: Add the server actions**

In `apps/web/src/actions/projects.ts`, after `deleteProjectAction`:

```ts
export async function archiveProjectAction(
  orgId: string,
  projectId: string,
): Promise<{ error?: string; project?: ProjectDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  try {
    const { data: project } = await api.projects.archive(
      token,
      orgId,
      projectId,
    );
    revalidatePath(`/orgs/${orgId}`);
    revalidatePath(`/orgs/${orgId}/projects/${projectId}`);
    return { project };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to archive project",
    };
  }
}

export async function restoreProjectAction(
  orgId: string,
  projectId: string,
): Promise<{ error?: string; project?: ProjectDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  try {
    const { data: project } = await api.projects.restore(
      token,
      orgId,
      projectId,
    );
    revalidatePath(`/orgs/${orgId}`);
    revalidatePath(`/orgs/${orgId}/projects/${projectId}`);
    return { project };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to restore project",
    };
  }
}
```

- [ ] **Step 3: Type check**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api/projects.ts apps/web/src/actions/projects.ts
git commit -m "feat(web): add archive and restore project actions"
```

---

### Task 6: Archive / Restore in the project danger zone

**Files:**

- Modify: `apps/web/src/components/project-settings/ProjectDangerTab.tsx`
- Modify: `apps/web/src/components/ProjectSettingsModal.tsx`

**Interfaces:**

- Consumes: `archiveProjectAction` / `restoreProjectAction` from Task 5; `ProjectDto.archivedAt`.
- Produces: `ProjectDangerTab` gains props
  `archiveError: string | null`, `onArchive: () => void`, `onRestore: () => void`.

- [ ] **Step 1: Add the archive card to `ProjectDangerTab`**

Extend the props and render an amber card above the existing red one. The component stays
presentational — the confirm dialog is local `useState`, everything else comes from props.

```tsx
"use client";

import { useState } from "react";
import type { ProjectDto } from "@kanban/shared";

export function ProjectDangerTab({
  project,
  confirmDeleteText,
  deleteError,
  archiveError,
  isPending,
  onConfirmTextChange,
  onDelete,
  onArchive,
  onRestore,
}: {
  project: ProjectDto;
  confirmDeleteText: string;
  deleteError: string | null;
  archiveError: string | null;
  isPending: boolean;
  onConfirmTextChange: (value: string) => void;
  onDelete: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const isArchived = project.archivedAt !== null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-8 shadow-sm">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-xl">
            📦
          </div>
          <div>
            <h4 className="text-lg font-bold text-amber-900">
              {isArchived ? "Restore Project" : "Archive Project"}
            </h4>
            <p className="text-sm text-amber-800 mt-1">
              {isArchived ? (
                <>
                  Archived on{" "}
                  <span className="font-bold">
                    {new Date(project.archivedAt as string).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </span>
                  . Restoring puts it back in the main project lists and removes
                  the archive notice from its wiki page.
                </>
              ) : (
                <>
                  Archiving hides{" "}
                  <span className="font-bold">"{project.name}"</span> from the
                  main project lists and adds an archive notice to its wiki
                  page. Nothing is deleted, the project stays editable, and you
                  can restore it at any time.
                </>
              )}
            </p>
          </div>
        </div>

        {isArchived ? (
          <button
            onClick={onRestore}
            disabled={isPending}
            className="w-full px-4 py-3 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-all shadow-md shadow-amber-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isPending ? "Restoring Project..." : "Restore Project"}
          </button>
        ) : confirmingArchive ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-amber-900">
              Archive "{project.name}"?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setConfirmingArchive(false);
                  onArchive();
                }}
                disabled={isPending}
                className="flex-1 px-4 py-3 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-all shadow-md shadow-amber-200 disabled:opacity-50 active:scale-[0.98]"
              >
                {isPending ? "Archiving Project..." : "Yes, archive it"}
              </button>
              <button
                onClick={() => setConfirmingArchive(false)}
                disabled={isPending}
                className="flex-1 px-4 py-3 text-sm font-bold text-amber-900 bg-white border border-amber-200 rounded-lg hover:bg-amber-50 transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingArchive(true)}
            disabled={isPending}
            className="w-full px-4 py-3 text-sm font-bold text-amber-900 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            Archive Project
          </button>
        )}

        {archiveError && (
          <p className="text-xs text-amber-700 mt-4 font-bold">
            {archiveError}
          </p>
        )}
      </div>

      {/* existing red delete card stays exactly as it is, unchanged */}
    </div>
  );
}
```

Keep the existing delete `<div className="bg-red-50/50 …">` block verbatim where the comment
is — do not rewrite it.

- [ ] **Step 2: Wire the modal**

In `apps/web/src/components/ProjectSettingsModal.tsx`:

Extend the import:

```tsx
import {
  archiveProjectAction,
  deleteProjectAction,
  getProjectSettingsDataAction,
  restoreProjectAction,
  updateProjectAction,
} from "@/actions/projects";
```

Add state next to `deleteError`:

```tsx
const [archiveError, setArchiveError] = useState<string | null>(null);
```

Pass the new props to `ProjectDangerTab`:

```tsx
<ProjectDangerTab
  project={data.project}
  confirmDeleteText={confirmDeleteText}
  deleteError={deleteError}
  archiveError={archiveError}
  isPending={isPending}
  onConfirmTextChange={setConfirmDeleteText}
  onDelete={() => handleDelete(orgId, projectId)}
  onArchive={() => handleArchiveToggle(orgId, projectId, "archive")}
  onRestore={() => handleArchiveToggle(orgId, projectId, "restore")}
/>
```

Add the handler next to `handleDelete`:

```tsx
function handleArchiveToggle(
  currentOrgId: string,
  currentProjectId: string,
  mode: "archive" | "restore",
) {
  setArchiveError(null);
  startTransition(async () => {
    const result =
      mode === "archive"
        ? await archiveProjectAction(currentOrgId, currentProjectId)
        : await restoreProjectAction(currentOrgId, currentProjectId);
    if (result.error || !result.project) {
      setArchiveError(result.error ?? "Failed to update project");
      return;
    }
    const project = result.project;
    setData((prev) => (prev ? { ...prev, project } : null));
    router.refresh();
  });
}
```

- [ ] **Step 3: Type check and lint**

Run: `pnpm build && pnpm lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/project-settings/ProjectDangerTab.tsx \
  apps/web/src/components/ProjectSettingsModal.tsx
git commit -m "feat(web): archive and restore a project from the danger zone"
```

---

### Task 7: Collapsible archived section on the organization project list

**Files:**

- Modify: `apps/web/src/app/(app)/orgs/[orgId]/ProjectListClient.tsx`

**Interfaces:**

- Consumes: `ProjectDto.archivedAt`.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Split the incoming projects**

At the top of the component body, after the `useState` declarations:

```tsx
const activeProjects = projects.filter((p) => p.archivedAt === null);
const archivedProjects = projects.filter((p) => p.archivedAt !== null);
```

- [ ] **Step 2: Render active projects in the main grid**

Replace `projects.length === 0` with `activeProjects.length === 0` in the empty-state
condition, and `projects.map((p) => (` with `activeProjects.map((p) => (` in the grid.
Everything else in the card markup stays the same.

- [ ] **Step 3: Add the collapsible archived section**

Immediately after the closing tag of the grid / empty-state conditional, still inside the
outer `<div className="max-w-4xl mx-auto">`:

```tsx
{
  archivedProjects.length > 0 && (
    <details className="mt-10 group/archived">
      <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors select-none">
        <span className="transition-transform group-open/archived:rotate-90">
          ▶
        </span>
        Archived projects ({archivedProjects.length})
      </summary>
      <div className="grid gap-6 sm:grid-cols-2 mt-6">
        {archivedProjects.map((p) => (
          <div key={p.id} className="relative group">
            <Link
              href={`/orgs/${orgId}/projects/${p.id}`}
              className="block bg-gray-50 border border-gray-200 rounded-2xl p-6 opacity-75 hover:opacity-100 hover:border-gray-400 transition-all duration-300 h-full"
            >
              <div className="flex items-center gap-2 pr-10">
                <span className="font-bold text-gray-700 text-lg truncate">
                  {p.name}
                </span>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  Archived
                </span>
              </div>
              <div className="text-xs font-medium text-gray-400 mt-2">
                Archived{" "}
                {new Date(p.archivedAt as string).toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric", year: "numeric" },
                )}
              </div>
            </Link>
            <button
              onClick={() => setActiveProjectSettings(p.id)}
              className="absolute top-5 right-5 px-1 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all text-sm"
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}
```

Before writing the settings button, read the existing active-card markup in this file and
copy its settings-button markup and positioning verbatim so both grids behave identically.

- [ ] **Step 4: Type check and lint**

Run: `pnpm build && pnpm lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/orgs/[orgId]/ProjectListClient.tsx"
git commit -m "feat(web): list archived projects in a collapsible section"
```

---

### Task 8: Sidebar archived section and archived banner on the board

**Files:**

- Modify: `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/ProjectSidebar.tsx`
- Modify: `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/ProjectClientLayout.tsx`
- Create: `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/project-layout/ArchivedProjectBanner.tsx`

**Interfaces:**

- Consumes: `ProjectDto.archivedAt`; `projects` and `projectId` props already passed to both
  components.
- Produces: `ArchivedProjectBanner({ projectName }: { projectName: string })`.

Note on placement: the app header (`HeaderTabs`) has no access to project data, so the
"Archived" indicator from the spec is rendered as a thin banner at the top of the project
content area instead of inside the header chrome. Same purpose, no prop plumbing through the
global layout.

- [ ] **Step 1: Split the projects in the sidebar**

In `ProjectSidebar.tsx`, add local state next to the other `useState` calls:

```tsx
const [showArchived, setShowArchived] = useState(false);
```

After `const actuallyExpanded = …`, add:

```tsx
const activeProjects = projects.filter((p) => p.archivedAt === null);
const archivedProjects = projects.filter((p) => p.archivedAt !== null);
```

Change the nav list to `activeProjects.map((p) => (`. Leave the row markup untouched.

- [ ] **Step 2: Add the archived section above "New project"**

Inside the footer `<div className="flex-none p-2 border-t border-gray-100 space-y-1 bg-white">`,
as the **first** child, before the "New project" `<Link>`:

```tsx
{
  archivedProjects.length > 0 && (
    <div className="space-y-0.5">
      <button
        onClick={() => setShowArchived((prev) => !prev)}
        className="w-full flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <span
          className={`text-[10px] transition-transform ${
            showArchived ? "rotate-90" : ""
          }`}
        >
          ▶
        </span>
        Archived ({archivedProjects.length})
      </button>
      {showArchived &&
        archivedProjects.map((p) => (
          <div key={p.id} className="group flex items-center gap-1">
            <Link
              href={`/orgs/${orgId}/projects/${p.id}`}
              className={`flex-1 flex items-center px-3 py-2 pl-6 rounded-md text-sm transition-colors truncate ${
                p.id === projectId
                  ? "bg-amber-50 text-amber-800 font-medium"
                  : "text-gray-400 hover:bg-gray-100"
              }`}
            >
              {p.name}
            </Link>
            <button
              onClick={() => setActiveProjectSettings(p.id)}
              className="shrink-0 px-1 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all text-sm"
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        ))}
    </div>
  );
}
```

- [ ] **Step 3: Auto-expand when the current project is archived**

Right after the `activeProjects` / `archivedProjects` split — but note hooks cannot run after
the early `if (!isHydrated) return …`, so put this effect next to the existing
`useEffect` that sets `isHydrated`, near the top of the component:

```tsx
useEffect(() => {
  const currentIsArchived = projects.some(
    (p) => p.id === projectId && p.archivedAt !== null,
  );
  if (currentIsArchived) setShowArchived(true);
}, [projects, projectId]);
```

- [ ] **Step 4: Create the banner component**

Create `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/project-layout/ArchivedProjectBanner.tsx`:

```tsx
export function ArchivedProjectBanner({
  projectName,
}: {
  projectName: string;
}) {
  return (
    <div className="flex-none flex items-center gap-2 px-4 py-1.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
      <span className="font-bold uppercase tracking-wide text-[10px] bg-amber-100 px-2 py-0.5 rounded-full">
        Archived
      </span>
      <span className="truncate">
        "{projectName}" is archived. It stays editable — restore it from Project
        Settings → Danger Zone.
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Render the banner in the layout**

In `ProjectClientLayout.tsx`, import it:

```tsx
import { ArchivedProjectBanner } from "./project-layout/ArchivedProjectBanner";
```

Derive the current project after the `filteredPages` line:

```tsx
const currentProject = projects.find((p) => p.id === projectId);
```

Inside `<div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">`, as the
first child before `<ProjectContentArea …>`:

```tsx
{
  currentProject?.archivedAt && (
    <ArchivedProjectBanner projectName={currentProject.name} />
  );
}
```

- [ ] **Step 6: Type check and lint**

Run: `pnpm build && pnpm lint`
Expected: PASS

- [ ] **Step 7: Manual verification**

Run: `pnpm dev`

Then, in the browser:

1. Open an organization, open a project's Settings → Danger Zone, click "Archive Project",
   confirm.
2. Back on the organization page: the project is gone from the main grid and appears under
   the collapsed "Archived projects (1)" section.
3. Open the archived project's board: the amber "Archived" banner shows, and the sidebar's
   "Archived (1)" section is expanded with the project highlighted.
4. Open the Wiki tab → the project's `KB: <name>` page shows the collapsed
   "⚠️ Archived project" details block with the archive date; the Organization Index page
   has an `### Archived` section.
5. Settings → Danger Zone → "Restore Project": the project returns to the main grid, the
   banner disappears, the wiki details block and the `### Archived` section are gone.

Report anything that does not match before committing.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]"
git commit -m "feat(web): surface archived projects in the sidebar and board"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full suite**

Run: `pnpm --filter @kanban/api test`
Expected: PASS, no skipped tests introduced by this work.

- [ ] **Step 2: Lint and build**

Run: `pnpm lint && pnpm build`
Expected: PASS. Pre-existing `no-explicit-any` warnings in `packages/shared/src/dtos/wiki.ts`
are expected and unrelated — no new warnings or errors.

- [ ] **Step 3: Spec cross-check**

Re-read `docs/superpowers/specs/2026-08-07-project-archiving-design.md` and confirm each
section has landed. Report any deviation (the banner placement in Task 8 is a known,
documented one).
