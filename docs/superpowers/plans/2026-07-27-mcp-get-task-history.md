# get_task_history MCP Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing `task_history` records through a new MCP tool `get_task_history`, newest-first, with a field filter, pagination, and value truncation.

**Architecture:** `TaskService.getTaskHistory(taskId)` already returns `TaskHistoryDto[]` with the actor resolved; it only lacks a deterministic `ORDER BY`. Task 1 adds that ordering in the service. Task 2 adds the MCP tool in `task-list-tools.ts`, which does existence-check → field filter → page slice → value truncation, mirroring how `list_tasks` filters over `listTasks`. Nothing else changes: the HTTP route `task-routes/crud.ts` and the web task-detail sidebar keep receiving the full untruncated list, only newly sorted newest-first (the sidebar renders `history.map` as-is, no re-sort, so this is safe).

**Tech Stack:** TypeScript, Drizzle ORM (better-sqlite3), `@modelcontextprotocol/sdk`, zod, Vitest.

Spec: `docs/superpowers/specs/2026-07-27-mcp-get-task-history-design.md`

---

## File Structure

- Modify: `apps/api/src/features/task/task-service/update-delete-history.ts` — add `desc` import and `orderBy` in `getTaskHistory` (~line 224).
- Modify: `apps/api/src/features/mcp/mcp-server/task-list-tools.ts` — add `get_task_history` registration plus a local `truncateHistoryValue` helper.
- Create: `apps/api/src/tests/features/task-history.test.ts` — service-level ordering tests against a real in-memory DB.
- Modify: `apps/api/src/tests/features/mcp-task-list-tools.test.ts` — extend the existing harness with `getTaskHistory` and add a `get_task_history` describe block.

---

## Task 1: Deterministic newest-first ordering in the service

**Files:**

- Modify: `apps/api/src/features/task/task-service/update-delete-history.ts` (line 1 import, line 224-229 query)
- Test: `apps/api/src/tests/features/task-history.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/tests/features/task-history.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb } from "../../db/test-utils.js";
import { IdentityService } from "../../features/identity/identity.service.js";
import { OrganizationService } from "../../features/organization/organization.service.js";
import { ProjectService } from "../../features/project/project.service.js";
import { TaskService } from "../../features/task/task.service.js";
import { taskHistory } from "../../db/schema/index.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

async function setup() {
  const testDb = createTestDb();
  const idSvc = new IdentityService(testDb.db);
  const orgSvc = new OrganizationService(testDb.db);
  const projSvc = new ProjectService(testDb.db);
  const taskSvc = new TaskService(testDb.db);

  const user = await idSvc.register({
    email: "alice@example.com",
    password: "password123",
    displayName: "Alice",
  });
  const org = orgSvc.createOrg(user.id, { name: "Acme" });
  const project = projSvc.createProject(org.id, { name: "Sprint 1" });
  const task = taskSvc.createTask(project.id, user.id, {
    title: "Fix bug",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });

  return { testDb, user, project, task, taskSvc };
}

function insertHistory(
  testDb: { db: any },
  row: {
    id: string;
    taskId: string;
    userId: string;
    field: string;
    changedAt: string;
    batchId?: string | null;
  },
) {
  testDb.db
    .insert(taskHistory)
    .values({
      id: row.id,
      taskId: row.taskId,
      userId: row.userId,
      field: row.field,
      oldValue: "old",
      newValue: "new",
      changedAt: row.changedAt,
      batchId: row.batchId ?? null,
    })
    .run();
}

describe("TaskService.getTaskHistory ordering", () => {
  it("returns entries newest first", async () => {
    const { testDb, user, task, taskSvc } = await setup();
    insertHistory(testDb, {
      id: "h-old",
      taskId: task.id,
      userId: user.id,
      field: "title",
      changedAt: "2026-01-01 10:00:00",
    });
    insertHistory(testDb, {
      id: "h-new",
      taskId: task.id,
      userId: user.id,
      field: "column",
      changedAt: "2026-03-01 10:00:00",
    });
    insertHistory(testDb, {
      id: "h-mid",
      taskId: task.id,
      userId: user.id,
      field: "objective",
      changedAt: "2026-02-01 10:00:00",
    });

    const history = taskSvc.getTaskHistory(task.id);

    expect(history.map((entry) => entry.id)).toEqual([
      "h-new",
      "h-mid",
      "h-old",
    ]);
    testDb.close();
  });

  it("breaks changedAt ties deterministically by id descending", async () => {
    const { testDb, user, task, taskSvc } = await setup();
    for (const id of ["h-a", "h-c", "h-b"]) {
      insertHistory(testDb, {
        id,
        taskId: task.id,
        userId: user.id,
        field: "title",
        changedAt: "2026-02-02 09:00:00",
        batchId: "batch-1",
      });
    }

    const history = taskSvc.getTaskHistory(task.id);

    expect(history.map((entry) => entry.id)).toEqual(["h-c", "h-b", "h-a"]);
    testDb.close();
  });

  it("resolves the actor for each entry", async () => {
    const { testDb, user, task, taskSvc } = await setup();
    insertHistory(testDb, {
      id: "h-1",
      taskId: task.id,
      userId: user.id,
      field: "title",
      changedAt: "2026-02-02 09:00:00",
    });

    const history = taskSvc.getTaskHistory(task.id);

    expect(history[0]!.actor).toEqual({ id: user.id, displayName: "Alice" });
    testDb.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && rtk pnpm vitest run src/tests/features/task-history.test.ts`

Expected: the two ordering tests FAIL (rows come back in insertion order: `h-old, h-new, h-mid` and `h-a, h-c, h-b`). The actor test passes already.

- [ ] **Step 3: Add the ordering to the service**

In `apps/api/src/features/task/task-service/update-delete-history.ts`, change the import on line 1:

```ts
import { desc, eq, sql } from "drizzle-orm";
```

and the query in `getTaskHistory` (line ~225):

```ts
  getTaskHistory(taskId: string): TaskHistoryDto[] {
    const rows = this.db
      .select()
      .from(taskHistory)
      .where(eq(taskHistory.taskId, taskId))
      .orderBy(desc(taskHistory.changedAt), desc(taskHistory.id))
      .all();
```

Leave the rest of the method (the `rows.map` that resolves the actor) untouched.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && rtk pnpm vitest run src/tests/features/task-history.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Run the full API test suite**

Run: `cd apps/api && rtk pnpm test`
Expected: all pass. `task-append-note.test.ts` asserts on a filtered single-entry history, so ordering does not affect it — if anything else fails on order assumptions, fix that test to sort explicitly rather than reverting the service change.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/features/task/task-service/update-delete-history.ts apps/api/src/tests/features/task-history.test.ts
git commit -m "fix(task): order task history newest-first deterministically"
```

---

## Task 2: `get_task_history` MCP tool

**Files:**

- Modify: `apps/api/src/features/mcp/mcp-server/task-list-tools.ts`
- Test: `apps/api/src/tests/features/mcp-task-list-tools.test.ts`

- [ ] **Step 1: Extend the test harness with history**

In `apps/api/src/tests/features/mcp-task-list-tools.test.ts`, change `makeHarness` so it also serves history entries. Replace the existing `makeHarness` (lines 8-29) with:

```ts
function makeHarness(tasks: any[] = [], history: any[] = []) {
  const tools = new Map<string, (input: any) => any>();

  const server = {
    registerTool(name: string, _config: unknown, handler: any) {
      tools.set(name, handler);
    },
  };

  const taskSvc = {
    getTask(taskId: string) {
      return tasks.find((task) => task.id === taskId);
    },
    listTasks(projectId: string) {
      return tasks.filter((task) => task.projectId === projectId);
    },
    getTaskHistory(taskId: string) {
      return history.filter((entry) => entry.taskId === taskId);
    },
  };

  registerTaskListTools(server as any, taskSvc as any);

  return { tools, taskSvc };
}
```

Then add these helpers right after `listArgs` (after line 52):

```ts
function makeHistoryEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "hist-1",
    taskId: "task-1",
    field: "column",
    oldValue: "todo",
    newValue: "doing",
    actor: { id: "user-1", displayName: "Alice" },
    changedAt: "2026-07-27 18:04:11",
    batchId: "batch-1",
    ...overrides,
  };
}

function historyArgs(overrides: Record<string, unknown> = {}) {
  return { taskId: "task-1", page: 1, limit: 50, ...overrides };
}
```

- [ ] **Step 2: Write the failing tests**

Append this describe block at the end of `apps/api/src/tests/features/mcp-task-list-tools.test.ts`:

```ts
describe("get_task_history MCP tool", () => {
  it("returns entries and a pagination block", () => {
    const entries = [
      makeHistoryEntry({ id: "h-2", changedAt: "2026-07-27 18:04:11" }),
      makeHistoryEntry({
        id: "h-1",
        field: "title",
        changedAt: "2026-07-26 09:00:00",
      }),
    ];
    const { tools } = makeHarness([makeTask()], entries);
    const getHistory = tools.get("get_task_history");
    expect(getHistory).toBeDefined();

    const result = parseToolResult(getHistory!(historyArgs()));

    expect(result.taskId).toBe("task-1");
    expect(result.entries).toEqual([
      {
        field: "column",
        oldValue: "todo",
        newValue: "doing",
        actor: { id: "user-1", displayName: "Alice" },
        changedAt: "2026-07-27 18:04:11",
        batchId: "batch-1",
      },
      {
        field: "title",
        oldValue: "todo",
        newValue: "doing",
        actor: { id: "user-1", displayName: "Alice" },
        changedAt: "2026-07-26 09:00:00",
        batchId: "batch-1",
      },
    ]);
    expect(result.pagination).toEqual({
      total: 2,
      page: 1,
      limit: 50,
      totalPages: 1,
    });
  });

  it("paginates with page and limit", () => {
    const entries = Array.from({ length: 7 }, (_, index) =>
      makeHistoryEntry({ id: `h-${index}`, newValue: `value-${index}` }),
    );
    const { tools } = makeHarness([makeTask()], entries);

    const result = parseToolResult(
      tools.get("get_task_history")!(historyArgs({ page: 2, limit: 3 })),
    );

    expect(result.entries.map((entry: any) => entry.newValue)).toEqual([
      "value-3",
      "value-4",
      "value-5",
    ]);
    expect(result.pagination).toEqual({
      total: 7,
      page: 2,
      limit: 3,
      totalPages: 3,
    });
  });

  it("filters by field and reflects the filter in the total", () => {
    const entries = [
      makeHistoryEntry({ id: "h-1", field: "column" }),
      makeHistoryEntry({ id: "h-2", field: "description" }),
      makeHistoryEntry({ id: "h-3", field: "column" }),
    ];
    const { tools } = makeHarness([makeTask()], entries);

    const result = parseToolResult(
      tools.get("get_task_history")!(historyArgs({ field: "column" })),
    );

    expect(result.entries).toHaveLength(2);
    expect(result.entries.every((entry: any) => entry.field === "column")).toBe(
      true,
    );
    expect(result.pagination.total).toBe(2);
  });

  it("returns an error result when the task does not exist", () => {
    const { tools } = makeHarness([], []);

    const result = tools.get("get_task_history")!(
      historyArgs({ taskId: "missing" }),
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Task not found");
  });

  it("returns an empty page for a known task with no history", () => {
    const { tools } = makeHarness([makeTask()], []);

    const result = parseToolResult(
      tools.get("get_task_history")!(historyArgs()),
    );

    expect(result.entries).toEqual([]);
    expect(result.pagination).toEqual({
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    });
  });

  it("truncates long old and new values", () => {
    const long = "x".repeat(600);
    const { tools } = makeHarness(
      [makeTask()],
      [makeHistoryEntry({ oldValue: long, newValue: long })],
    );

    const result = parseToolResult(
      tools.get("get_task_history")!(historyArgs()),
    );

    expect(result.entries[0].oldValue).toBe(`${"x".repeat(500)}…[truncated]`);
    expect(result.entries[0].newValue).toBe(`${"x".repeat(500)}…[truncated]`);
  });

  it("leaves short and null values untouched", () => {
    const { tools } = makeHarness(
      [makeTask()],
      [makeHistoryEntry({ oldValue: null, newValue: "doing" })],
    );

    const result = parseToolResult(
      tools.get("get_task_history")!(historyArgs()),
    );

    expect(result.entries[0].oldValue).toBeNull();
    expect(result.entries[0].newValue).toBe("doing");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/api && rtk pnpm vitest run src/tests/features/mcp-task-list-tools.test.ts`
Expected: the `get_task_history` tests FAIL — `expect(getHistory).toBeDefined()` fails and the others throw `getHistory is not a function`, because the tool is not registered yet. The `get_task` / `list_tasks` blocks still pass.

- [ ] **Step 4: Implement the tool**

In `apps/api/src/features/mcp/mcp-server/task-list-tools.ts`, add this helper above `registerTaskListTools` (after the imports on line 4):

```ts
const HISTORY_VALUE_LIMIT = 500;

function truncateHistoryValue(value: string | null) {
  if (value === null) return null;
  return value.length > HISTORY_VALUE_LIMIT
    ? `${value.slice(0, HISTORY_VALUE_LIMIT)}…[truncated]`
    : value;
}
```

Then register the tool inside `registerTaskListTools`, after the `list_tasks` registration and before the closing `}` of the function:

```ts
server.registerTool(
  "get_task_history",
  {
    description:
      "Get the change history of a task, newest first — who changed which field, from what to what, and when. Use it to resume work after an interruption or to reconstruct how a task progressed. Long values are truncated to 500 characters.",
    inputSchema: {
      taskId: z.string().describe("Task ID"),
      field: z
        .string()
        .optional()
        .describe(
          "Filter by changed field name, e.g. column, title, description, doerId",
        ),
      page: z.number().int().min(1).default(1).describe("Page number"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(50)
        .describe("Max entries per call (1-100, default 50)"),
    },
  },
  ({ taskId, field, page, limit }) => {
    if (!taskSvc.getTask(taskId)) return textResult("Task not found", true);

    let entries = taskSvc.getTaskHistory(taskId);
    if (field) entries = entries.filter((entry) => entry.field === field);

    const total = entries.length;
    const offset = (page - 1) * limit;
    return jsonText({
      taskId,
      entries: entries.slice(offset, offset + limit).map((entry) => ({
        field: entry.field,
        oldValue: truncateHistoryValue(entry.oldValue),
        newValue: truncateHistoryValue(entry.newValue),
        actor: entry.actor,
        changedAt: entry.changedAt,
        batchId: entry.batchId,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  },
);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && rtk pnpm vitest run src/tests/features/mcp-task-list-tools.test.ts`
Expected: all pass, including the 7 new `get_task_history` tests.

- [ ] **Step 6: Typecheck and lint**

Run: `rtk pnpm typecheck && rtk pnpm lint`
Expected: no errors. If `entry` is implicitly `any` in the `.filter`/`.map` callbacks, that means `taskSvc.getTaskHistory`'s return type is not flowing through — confirm the parameter type is `TaskService`, not `any`.

- [ ] **Step 7: Run the full API test suite**

Run: `cd apps/api && rtk pnpm test`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/features/mcp/mcp-server/task-list-tools.ts apps/api/src/tests/features/mcp-task-list-tools.test.ts
git commit -m "feat(mcp): add get_task_history tool with field filter and pagination"
```

---

## Task 3: Verify against a real MCP call

**Files:** none modified — verification only.

- [ ] **Step 1: Start the API**

Run: `rtk pnpm dev` (API listens on port 3001).

- [ ] **Step 2: Exercise the tool through the kanban MCP server**

Pick a task that has been edited several times (e.g. via `list_tasks`), then call `get_task_history` with that `taskId`.

Expected: newest entry first; `pagination.total` matches the number of recorded changes; a `field: "description"` entry from an `append_task_note` call shows a truncated `newValue` ending in `…[truncated]`.

- [ ] **Step 3: Check the web sidebar still reads correctly**

Open a task's detail sidebar in the web app and expand History.

Expected: the feed renders newest-first with no errors — it maps the array as-is (`HistoryFeed.tsx`), so no code change is needed there.

- [ ] **Step 4: Stop the dev server**

---

## Out of scope (from the spec)

- Grouping entries by `batchId` into changelog-style records
- Date-range filters
- Changing the HTTP route in `apps/api/src/features/task/task-routes/crud.ts` — it keeps returning the full, untruncated, unpaginated list (now newest-first)
