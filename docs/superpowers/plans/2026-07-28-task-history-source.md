# Task History Source (MCP vs Web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record on every new `task_history` row whether the change came from the MCP server or the web front, expose it in the API DTO, and show it in the task history feed — while rows written before this change stay unmarked.

**Architecture:** Add a nullable `source` TEXT column to `task_history`. The API already threads an optional `isMcp?: boolean` flag through `TaskService` for WebSocket broadcasts; a new `historySource(isMcp)` helper on `TaskServiceBase` turns that flag into `"mcp"` or `"web"` and every `insert(taskHistory)` call passes it. Two service files (`participants.ts`, `relations.ts`) don't receive `isMcp` yet, so it gets plumbed through them and their `TaskService` façade methods. Reads map the column straight through: `NULL` stays `null`, and the web badge is skipped for `null`.

**Tech Stack:** TypeScript, Hono, Drizzle ORM + better-sqlite3, Vitest, Next.js 14 App Router, pnpm workspaces + Turborepo.

**Spec:** `docs/superpowers/specs/2026-07-28-task-history-source-design.md`

---

## Background for the implementer

- Monorepo layout: `apps/api` (all domain logic + DB), `apps/web` (Next.js BFF, no DB access), `packages/shared` (DTOs only).
- Tests live in `apps/api/src/tests/`. Run them from `apps/api` with `pnpm test`. A single file: `pnpm vitest run src/tests/features/task-history.test.ts`.
- `createTestDb()` (`apps/api/src/db/test-utils.ts`) spins up an in-memory SQLite database and **runs the committed migrations**. So a schema change is only visible to tests once the migration file exists in `apps/api/drizzle/migrations/`.
- Drizzle migrations are generated, never hand-written: `cd apps/api && pnpm drizzle-kit generate`. The generated file gets an auto-generated name like `0009_<two_random_words>.sql` — use whatever name the tool produces and commit both the `.sql` file and the updated `meta/` files.
- Imports inside `apps/api` use explicit `.js` extensions (ESM). Follow the surrounding style.
- `pnpm format` (Prettier) is run before committing; `pnpm lint` and `pnpm build` run from the repo root.

**Vocabulary:** "source" is `"mcp"` when the caller passed `isMcp === true`, `"web"` in every other case (REST routes pass nothing). There is no third value and no backfill of old rows.

---

### Task 1: Schema column, DTO field, and read mapping

Adds the column, the shared type, and the read path. After this task new rows still have `source = NULL` — writers come in Tasks 2-6.

**Files:**

- Modify: `packages/shared/src/dtos/board.ts:29-38`
- Modify: `apps/api/src/db/schema/board.ts:96-111`
- Create: `apps/api/drizzle/migrations/0009_<generated>.sql` (via drizzle-kit)
- Modify: `apps/api/src/features/task/task-service/update-delete-history.ts:224-249` (`getTaskHistory`)
- Test: `apps/api/src/tests/features/task-history.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test at the end of `apps/api/src/tests/features/task-history.test.ts`, inside the existing
`describe("TaskService.getTaskHistory ordering", ...)` block (just before its closing `});`):

```ts
it("returns source null for rows written before source tracking", async () => {
  const { testDb, user, task, taskSvc } = await setup();
  insertHistory(testDb, {
    id: "h-legacy",
    taskId: task.id,
    userId: user.id,
    field: "title",
    changedAt: "2026-02-02 09:00:00",
  });

  const history = taskSvc.getTaskHistory(task.id);

  expect(history[0]!.source).toBeNull();
  testDb.close();
});
```

Note: `insertHistory` (defined at the top of that file) never sets `source`, which is exactly the
legacy-row case this test pins down.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm vitest run src/tests/features/task-history.test.ts
```

Expected: FAIL — TypeScript/vitest error that `source` does not exist on type `TaskHistoryDto`.

- [ ] **Step 3: Add the shared DTO field**

In `packages/shared/src/dtos/board.ts`, replace the `TaskHistoryDto` interface with:

```ts
export type TaskHistorySource = "mcp" | "web";

export interface TaskHistoryDto {
  id: string;
  taskId: string;
  actor: Pick<UserDto, "id" | "displayName">;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  batchId: string | null;
  source: TaskHistorySource | null;
}
```

Check that `packages/shared/src/index.ts` re-exports everything from `./dtos/board` (it exports the
DTO module wholesale — if it lists type names one by one, add `TaskHistorySource` to that list).

- [ ] **Step 4: Add the schema column**

In `apps/api/src/db/schema/board.ts`, the `taskHistory` table becomes:

```ts
export const taskHistory = sqliteTable("task_history", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedAt: text("changed_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  batchId: text("batch_id"),
  // "mcp" | "web"; NULL on rows written before source tracking existed.
  source: text("source"),
});
```

- [ ] **Step 5: Generate the migration**

```bash
cd apps/api && pnpm drizzle-kit generate
```

Expected: creates `apps/api/drizzle/migrations/0009_<two_random_words>.sql` containing
`ALTER TABLE \`task_history\` ADD \`source\` text;`and updates`drizzle/migrations/meta/`.
Open the generated `.sql`and confirm it contains only that`ADD COLUMN`statement — if it contains
any`DROP` or table-recreation statement, stop and report it instead of continuing.

- [ ] **Step 6: Map the column in getTaskHistory**

In `apps/api/src/features/task/task-service/update-delete-history.ts`, the returned object literal
inside `getTaskHistory` gains one line:

```ts
return {
  id: row.id,
  taskId: row.taskId,
  actor,
  field: row.field,
  oldValue: row.oldValue,
  newValue: row.newValue,
  changedAt: row.changedAt,
  batchId: row.batchId,
  source: row.source as TaskHistorySource | null,
};
```

and the import at the top of the file becomes:

```ts
import type {
  TaskDto,
  TaskHistoryDto,
  TaskHistorySource,
} from "@kanban/shared";
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
cd apps/api && pnpm vitest run src/tests/features/task-history.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 8: Commit**

```bash
cd /Users/stephane/projects/saas/kanban && pnpm format
git add packages/shared/src apps/api/src/db/schema/board.ts apps/api/drizzle/migrations apps/api/src/features/task/task-service/update-delete-history.ts apps/api/src/tests/features/task-history.test.ts
git commit -m "feat(history): add nullable source column to task history"
```

---

### Task 2: `historySource` helper on TaskServiceBase

One place decides how `isMcp` maps to a source string, so no call site can invent its own rule.

**Files:**

- Modify: `apps/api/src/features/task/task-service/base.ts:1-16, 97-147`

- [ ] **Step 1: Add the helper**

In `apps/api/src/features/task/task-service/base.ts`, extend the type import at the top:

```ts
import type { Column, TaskDto, TaskHistorySource } from "@kanban/shared";
```

and add this method to the `TaskServiceBase` class, right after the constructor:

```ts
  /**
   * Origin recorded on task_history rows. Anything that is not an MCP call is
   * the web front, which is the only other client today.
   */
  protected historySource(isMcp?: boolean): TaskHistorySource {
    return isMcp ? "mcp" : "web";
  }
```

- [ ] **Step 2: Verify it typechecks**

```bash
cd apps/api && pnpm typecheck
```

Expected: PASS. (No test yet — the helper is exercised by Tasks 3-6. It is `protected`, so an unused
warning is not expected; if lint flags it, leave it and continue: Task 3 uses it.)

- [ ] **Step 3: Commit**

```bash
cd /Users/stephane/projects/saas/kanban && pnpm format
git add apps/api/src/features/task/task-service/base.ts
git commit -m "feat(history): add historySource helper to task service base"
```

---

### Task 3: Source on update, note, and tag replacement

`updateTask`, `appendNote` and the private `replaceTags` already receive `isMcp`.

**Files:**

- Modify: `apps/api/src/features/task/task-service/update-delete-history.ts:29-116` (`updateTask`), `118-170` (`appendNote`), `181-204` (`replaceTags`)
- Test: `apps/api/src/tests/features/task-history.test.ts`

- [ ] **Step 1: Write the failing tests**

Append this new `describe` block at the end of
`apps/api/src/tests/features/task-history.test.ts` (after the existing describe block):

```ts
describe("TaskService history source", () => {
  it("records web for a REST update and mcp for an MCP update", async () => {
    const { testDb, user, task, taskSvc } = await setup();

    taskSvc.updateTask(task.id, user.id, { title: "From the web" });
    taskSvc.updateTask(task.id, user.id, { title: "From MCP" }, true);

    const titles = taskSvc
      .getTaskHistory(task.id)
      .filter((entry) => entry.field === "title");
    const byNewValue = new Map(
      titles.map((entry) => [entry.newValue, entry.source]),
    );
    expect(byNewValue.get("From the web")).toBe("web");
    expect(byNewValue.get("From MCP")).toBe("mcp");
    testDb.close();
  });

  it("records the source of an appended note", async () => {
    const { testDb, user, task, taskSvc } = await setup();

    taskSvc.appendTaskNote(task.id, user.id, "web note");
    taskSvc.appendTaskNote(task.id, user.id, "mcp note", true);

    const notes = taskSvc
      .getTaskHistory(task.id)
      .filter((entry) => entry.field === "note");
    expect(new Set(notes.map((entry) => entry.source))).toEqual(
      new Set(["web", "mcp"]),
    );
    testDb.close();
  });

  it("records the source of a tag replacement", async () => {
    const { testDb, user, task, taskSvc } = await setup();

    taskSvc.updateTask(task.id, user.id, { tags: ["alpha"] }, true);

    const tagEntry = taskSvc
      .getTaskHistory(task.id)
      .find((entry) => entry.field === "tags");
    expect(tagEntry?.source).toBe("mcp");
    testDb.close();
  });
});
```

Note: `changedAt` only has second precision and ties are broken by a random id, so these tests match
entries by their values rather than by position whenever two rows can share a timestamp.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && pnpm vitest run src/tests/features/task-history.test.ts
```

Expected: FAIL — three tests fail with `expected null to be "mcp"` (or the array equivalent).

- [ ] **Step 3: Write source in updateTask**

In `update-delete-history.ts`, inside `updateTask`, resolve the source once above the `track` helper
and put it on each entry:

```ts
const existing = this.getRow(taskId);
const batchId = generateId();
const source = this.historySource(isMcp);
const historyEntries: Array<typeof taskHistory.$inferInsert> = [];
const updateSet: Record<string, unknown> = {};
const track = (field: string, oldVal: string | null, newVal: string | null) => {
  if (oldVal === newVal) return;
  historyEntries.push({
    id: generateId(),
    taskId,
    userId: actorId,
    field,
    oldValue: oldVal,
    newValue: newVal,
    batchId,
    source,
  });
  updateSet[field] = newVal;
};
```

- [ ] **Step 4: Pass source through to replaceTags**

Still inside `updateTask`, the two `replaceTags` call sites gain a trailing `source` argument:

```ts
if (input.tags !== undefined) {
  this.replaceTags(
    taskId,
    actorId,
    batchId,
    input.tags,
    "REST_REPLACED",
    source,
  );
} else if (usesTagDeltas) {
  const current = this.readTags(taskId);
  const removed = new Set(input.removeTags ?? []);
  const next = current.filter((tag) => !removed.has(tag));
  for (const tag of input.addTags ?? []) {
    if (!next.includes(tag)) next.push(tag);
  }
  if (next.join(", ") !== current.join(", ")) {
    this.replaceTags(
      taskId,
      actorId,
      batchId,
      next,
      current.join(", "),
      source,
    );
  }
}
```

and `replaceTags` itself becomes:

```ts
  private replaceTags(
    taskId: string,
    actorId: string,
    batchId: string,
    tags: string[],
    oldValue: string,
    source: TaskHistorySource,
  ): void {
    this.db.delete(taskTags).where(eq(taskTags.taskId, taskId)).run();
    for (const tag of tags) {
      this.db.insert(taskTags).values({ taskId, tag }).run();
    }
    this.db
      .insert(taskHistory)
      .values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: "tags",
        oldValue,
        newValue: tags.join(", "),
        batchId,
        source,
      })
      .run();
  }
```

- [ ] **Step 5: Write source in appendNote**

In `appendNote`, the history insert inside the transaction becomes:

```ts
tx.insert(taskHistory)
  .values({
    id: generateId(),
    taskId,
    userId: actorId,
    field: "note",
    oldValue: null,
    newValue: note,
    batchId: generateId(),
    source: this.historySource(isMcp),
  })
  .run();
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd apps/api && pnpm vitest run src/tests/features/task-history.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
cd /Users/stephane/projects/saas/kanban && pnpm format
git add apps/api/src/features/task/task-service/update-delete-history.ts apps/api/src/tests/features/task-history.test.ts
git commit -m "feat(history): record source on task update, note and tag replacement"
```

---

### Task 4: Source on column moves

**Files:**

- Modify: `apps/api/src/features/task/task-service/move.ts:9-92`
- Test: `apps/api/src/tests/features/task-history.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the `describe("TaskService history source", ...)` block created in Task 3:

```ts
it("records the source of a column move", async () => {
  const { testDb, user, task, taskSvc } = await setup();

  taskSvc.moveTask(task.id, user.id, { column: "todo" });

  const moveEntry = taskSvc
    .getTaskHistory(task.id)
    .find((entry) => entry.field === "column");
  expect(moveEntry?.source).toBe("web");
  testDb.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm vitest run src/tests/features/task-history.test.ts -t "column move"
```

Expected: FAIL with `expected null to be "web"`.

- [ ] **Step 3: Thread the source into insertMoveHistory**

In `apps/api/src/features/task/task-service/move.ts`, add the source argument to every
`insertMoveHistory` call and to its signature. Inside `moveTask`, after `const position = ...`:

```ts
const source = this.historySource(isMcp);
```

then the three call sites:

```ts
const batchId = autoAssignDoer ? generateId() : null;
if (input.column !== oldColumn) {
  this.insertMoveHistory(
    taskId,
    actorId,
    "column",
    oldColumn,
    input.column,
    batchId,
    source,
  );
}
if (autoAssignDoer) {
  this.insertMoveHistory(
    taskId,
    actorId,
    "doerId",
    null,
    actorId,
    batchId,
    source,
  );
}
if (clearsDoer) {
  this.insertMoveHistory(
    taskId,
    actorId,
    "doerId",
    row.doerId,
    null,
    null,
    source,
  );
}
```

and the private method:

```ts
  private insertMoveHistory(
    taskId: string,
    actorId: string,
    field: "column" | "doerId",
    oldValue: string | null,
    newValue: string | null,
    batchId: string | null,
    source: TaskHistorySource,
  ) {
    this.db
      .insert(taskHistory)
      .values({
        id: generateId(),
        taskId,
        userId: actorId,
        field,
        oldValue,
        newValue,
        batchId,
        source,
      })
      .run();
  }
```

Extend the type import at the top of the file:

```ts
import type { Column, TaskDto, TaskHistorySource } from "@kanban/shared";
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && pnpm vitest run src/tests/features/task-history.test.ts src/tests/features/task-move.test.ts src/tests/features/task-move-mcp.test.ts
```

Expected: PASS, all files green.

- [ ] **Step 5: Commit**

```bash
cd /Users/stephane/projects/saas/kanban && pnpm format
git add apps/api/src/features/task/task-service/move.ts apps/api/src/tests/features/task-history.test.ts
git commit -m "feat(history): record source on task column moves"
```

---

### Task 5: Source on archive and restore

**Files:**

- Modify: `apps/api/src/features/task/task-service/archive.ts:10-48` (`archiveTasks`), `50-102` (`restoreTask`)
- Test: `apps/api/src/tests/features/task-history.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the `describe("TaskService history source", ...)` block:

```ts
it("records the source of archive and restore", async () => {
  const { testDb, user, project, task, taskSvc } = await setup();

  taskSvc.moveTask(task.id, user.id, { column: "done" });
  taskSvc.archiveTasks(project.id, [task.id], user.id, true);
  taskSvc.restoreTask(task.id, user.id);

  const entries = taskSvc
    .getTaskHistory(task.id)
    .filter((entry) => entry.field === "archivedAt");
  // archive sets newValue to the timestamp, restore sets it back to null
  const archived = entries.find((entry) => entry.newValue !== null);
  const restored = entries.find((entry) => entry.newValue === null);
  expect(archived?.source).toBe("mcp");
  expect(restored?.source).toBe("web");
  testDb.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm vitest run src/tests/features/task-history.test.ts -t "archive and restore"
```

Expected: FAIL — `expected [ null, null ] to deeply equal [ "web", "mcp" ]`.

- [ ] **Step 3: Write source in archiveTasks**

In `apps/api/src/features/task/task-service/archive.ts`, the history insert inside the loop becomes:

```ts
this.db
  .insert(taskHistory)
  .values({
    id: generateId(),
    taskId,
    userId: actorId,
    field: "archivedAt",
    oldValue: null,
    newValue: now,
    batchId: null,
    source: this.historySource(isMcp),
  })
  .run();
```

- [ ] **Step 4: Write source in restoreTask**

In the same file, the insert inside the `restoreTask` transaction becomes:

```ts
tx.insert(taskHistory)
  .values({
    id: generateId(),
    taskId,
    userId: actorId,
    field: "archivedAt",
    oldValue: row.archivedAt,
    newValue: null,
    batchId: null,
    source: this.historySource(isMcp),
  })
  .run();
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && pnpm vitest run src/tests/features/task-history.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/stephane/projects/saas/kanban && pnpm format
git add apps/api/src/features/task/task-service/archive.ts apps/api/src/tests/features/task-history.test.ts
git commit -m "feat(history): record source on task archive and restore"
```

---

### Task 6: Plumb isMcp through tags and participants

`relations.ts` (`addTag` / `removeTag`) and `participants.ts` (watchers / advisors) write history but
receive no `isMcp` today. Add an optional trailing parameter so every history writer has a source.
`addLink` / `removeLink` write no history row and are left alone.

**Files:**

- Modify: `apps/api/src/features/task/task-service/relations.ts:9-73`
- Modify: `apps/api/src/features/task/task-service/participants.ts:12-118`
- Modify: `apps/api/src/features/task/task.service.ts:89-119`
- Test: `apps/api/src/tests/features/task-history.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the `describe("TaskService history source", ...)` block:

```ts
it("records the source of single tag add and remove", async () => {
  const { testDb, user, task, taskSvc } = await setup();

  taskSvc.addTag(task.id, "alpha", user.id, true);
  taskSvc.removeTag(task.id, "alpha", user.id);

  const entries = taskSvc
    .getTaskHistory(task.id)
    .filter((entry) => entry.field === "tags");
  const added = entries.find((entry) => entry.newValue === "alpha");
  const removed = entries.find((entry) => entry.oldValue === "alpha");
  expect(added?.source).toBe("mcp");
  expect(removed?.source).toBe("web");
  testDb.close();
});

it("records the source of watcher changes", async () => {
  const { testDb, user, task, taskSvc } = await setup();

  taskSvc.addWatcher(task.id, user.id, user.id, true);
  taskSvc.removeWatcher(task.id, user.id, user.id);

  const entries = taskSvc
    .getTaskHistory(task.id)
    .filter((entry) => entry.field === "watchers");
  const added = entries.find((entry) => entry.newValue === user.id);
  const removed = entries.find((entry) => entry.oldValue === user.id);
  expect(added?.source).toBe("mcp");
  expect(removed?.source).toBe("web");
  testDb.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && pnpm vitest run src/tests/features/task-history.test.ts
```

Expected: FAIL — TypeScript errors, `addTag`/`addWatcher` expect 3 arguments, got 4.

- [ ] **Step 3: Add isMcp to relations.ts**

In `apps/api/src/features/task/task-service/relations.ts`, only `addTag` and `removeTag` change.
Signatures gain `isMcp?: boolean`, the history inserts gain `source`, and the broadcasts gain
`isMcp` for consistency with the other operations:

```ts
  addTag(
    taskId: string,
    tag: string,
    actorId: string,
    isMcp?: boolean,
  ): TaskDto {
    const row = this.getRow(taskId);
    let inserted = false;
    try {
      this.db.insert(taskTags).values({ taskId, tag }).run();
      inserted = true;
    } catch {
      // duplicate, no-op
    }

    if (inserted) {
      this.db
        .insert(taskHistory)
        .values({
          id: generateId(),
          taskId,
          userId: actorId,
          field: "tags",
          oldValue: null,
          newValue: tag,
          changedAt: new Date().toISOString(),
          batchId: null,
          source: this.historySource(isMcp),
        })
        .run();
    }

    const dto = this.assemble(row);
    this.broadcast(`project:${row.projectId}`, {
      type: "task.updated",
      payload: dto,
      actorId,
      isMcp,
    });
    return dto;
  }

  removeTag(
    taskId: string,
    tag: string,
    actorId: string,
    isMcp?: boolean,
  ): TaskDto {
    const row = this.getRow(taskId);
    const changes = this.db
      .delete(taskTags)
      .where(and(eq(taskTags.taskId, taskId), eq(taskTags.tag, tag)))
      .run();
    if (changes.changes > 0) {
      this.db
        .insert(taskHistory)
        .values({
          id: generateId(),
          taskId,
          userId: actorId,
          field: "tags",
          oldValue: tag,
          newValue: null,
          changedAt: new Date().toISOString(),
          batchId: null,
          source: this.historySource(isMcp),
        })
        .run();
    }

    const dto = this.assemble(row);
    this.broadcast(`project:${row.projectId}`, {
      type: "task.updated",
      payload: dto,
      actorId,
      isMcp,
    });
    return dto;
  }
```

- [ ] **Step 4: Add isMcp to participants.ts**

In `apps/api/src/features/task/task-service/participants.ts`, all four public methods and both
private helpers gain the flag:

```ts
  addWatcher(
    taskId: string,
    userId: string,
    actorId: string,
    isMcp?: boolean,
  ): TaskDto {
    const row = this.getRow(taskId);
    this.assertOrgMember(row.projectId, userId);
    let added = false;
    try {
      this.db.insert(taskWatchers).values({ taskId, userId }).run();
      added = true;
    } catch {
      // already watching, no-op
    }
    if (added) {
      this.insertParticipantHistory(
        taskId,
        actorId,
        "watchers",
        null,
        userId,
        isMcp,
      );
    }
    return this.broadcastParticipantUpdate(row, actorId, isMcp);
  }

  removeWatcher(
    taskId: string,
    userId: string,
    actorId: string,
    isMcp?: boolean,
  ): TaskDto {
    const row = this.getRow(taskId);
    const existing = this.db
      .select()
      .from(taskWatchers)
      .where(
        and(eq(taskWatchers.taskId, taskId), eq(taskWatchers.userId, userId)),
      )
      .get();
    if (existing) {
      this.db
        .delete(taskWatchers)
        .where(
          and(eq(taskWatchers.taskId, taskId), eq(taskWatchers.userId, userId)),
        )
        .run();
      this.insertParticipantHistory(
        taskId,
        actorId,
        "watchers",
        userId,
        null,
        isMcp,
      );
    }
    return this.broadcastParticipantUpdate(row, actorId, isMcp);
  }

  addAdvisor(
    taskId: string,
    userId: string,
    actorId: string,
    isMcp?: boolean,
  ): TaskDto {
    const row = this.getRow(taskId);
    this.assertOrgMember(row.projectId, userId);
    let added = false;
    try {
      this.db.insert(taskAdvisors).values({ taskId, userId }).run();
      added = true;
    } catch {
      // already advising, no-op
    }
    if (added) {
      this.insertParticipantHistory(
        taskId,
        actorId,
        "advisors",
        null,
        userId,
        isMcp,
      );
    }
    return this.broadcastParticipantUpdate(row, actorId, isMcp);
  }

  removeAdvisor(
    taskId: string,
    userId: string,
    actorId: string,
    isMcp?: boolean,
  ): TaskDto {
    const row = this.getRow(taskId);
    const existing = this.db
      .select()
      .from(taskAdvisors)
      .where(
        and(eq(taskAdvisors.taskId, taskId), eq(taskAdvisors.userId, userId)),
      )
      .get();
    if (existing) {
      this.db
        .delete(taskAdvisors)
        .where(
          and(eq(taskAdvisors.taskId, taskId), eq(taskAdvisors.userId, userId)),
        )
        .run();
      this.insertParticipantHistory(
        taskId,
        actorId,
        "advisors",
        userId,
        null,
        isMcp,
      );
    }
    return this.broadcastParticipantUpdate(row, actorId, isMcp);
  }

  private insertParticipantHistory(
    taskId: string,
    actorId: string,
    field: "watchers" | "advisors",
    oldValue: string | null,
    newValue: string | null,
    isMcp?: boolean,
  ) {
    this.db
      .insert(taskHistory)
      .values({
        id: generateId(),
        taskId,
        userId: actorId,
        field,
        oldValue,
        newValue,
        batchId: null,
        source: this.historySource(isMcp),
      })
      .run();
  }

  private broadcastParticipantUpdate(
    row: ReturnType<TaskParticipantOperations["getRow"]>,
    actorId: string,
    isMcp?: boolean,
  ): TaskDto {
    const dto = this.assemble(row);
    this.broadcast(`project:${row.projectId}`, {
      type: "task.updated",
      payload: dto,
      actorId,
      isMcp,
    });
    return dto;
  }
```

- [ ] **Step 5: Forward the flag from the TaskService façade**

In `apps/api/src/features/task/task.service.ts`, replace the six methods (lines 89-119, leaving
`addLink`/`removeLink` untouched):

```ts
  addTag(
    taskId: string,
    tag: string,
    actorId: string,
    isMcp?: boolean,
  ): TaskDto {
    return this.relations.addTag(taskId, tag, actorId, isMcp);
  }

  removeTag(
    taskId: string,
    tag: string,
    actorId: string,
    isMcp?: boolean,
  ): TaskDto {
    return this.relations.removeTag(taskId, tag, actorId, isMcp);
  }
```

and

```ts
  addWatcher(
    taskId: string,
    userId: string,
    actorId: string,
    isMcp?: boolean,
  ): TaskDto {
    return this.participants.addWatcher(taskId, userId, actorId, isMcp);
  }

  removeWatcher(
    taskId: string,
    userId: string,
    actorId: string,
    isMcp?: boolean,
  ): TaskDto {
    return this.participants.removeWatcher(taskId, userId, actorId, isMcp);
  }

  addAdvisor(
    taskId: string,
    userId: string,
    actorId: string,
    isMcp?: boolean,
  ): TaskDto {
    return this.participants.addAdvisor(taskId, userId, actorId, isMcp);
  }

  removeAdvisor(
    taskId: string,
    userId: string,
    actorId: string,
    isMcp?: boolean,
  ): TaskDto {
    return this.participants.removeAdvisor(taskId, userId, actorId, isMcp);
  }
```

REST routes (`apps/api/src/features/task/task-routes/relations.ts`,
`apps/api/src/features/task/task-routes/participants.ts`) are **not** modified: they omit the
argument, which resolves to `"web"`.

- [ ] **Step 6: Run the full API suite**

```bash
cd apps/api && pnpm test
```

Expected: PASS, all tests green (214 + the new ones).

- [ ] **Step 7: Commit**

```bash
cd /Users/stephane/projects/saas/kanban && pnpm format
git add apps/api/src/features/task/task-service/relations.ts apps/api/src/features/task/task-service/participants.ts apps/api/src/features/task/task.service.ts apps/api/src/tests/features/task-history.test.ts
git commit -m "feat(history): record source on tag and participant changes"
```

---

### Task 7: Show the source in the history feed

**Files:**

- Modify: `apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/task-detail-sidebar/HistoryFeed.tsx`

The web app has no test suite, so this task is verified by typecheck + build.

- [ ] **Step 1: Render the badge**

Replace the whole content of
`apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/task-detail-sidebar/HistoryFeed.tsx` with:

```tsx
import type { TaskHistoryDto } from "@kanban/shared";

const SOURCE_LABELS: Record<NonNullable<TaskHistoryDto["source"]>, string> = {
  mcp: "via MCP",
  web: "via Web",
};

export function HistoryFeed({ history }: { history: TaskHistoryDto[] }) {
  if (!history || history.length === 0) {
    return <p className="text-xs text-gray-400">No history yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {history.map((entry) => (
        <li key={entry.id} className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">
            {entry.actor?.displayName || "System"}
          </span>
          {entry.source && (
            <span className="ml-1 text-gray-400">
              {SOURCE_LABELS[entry.source]}
            </span>
          )}
          {" changed "}
          <span className="font-medium">{entry.field}</span>
          {entry.oldValue !== null && (
            <>
              {" "}
              from{" "}
              <span className="line-through text-gray-400">
                {entry.oldValue}
              </span>
            </>
          )}
          {entry.newValue !== null && (
            <>
              {" "}
              to <span className="text-gray-700">{entry.newValue}</span>
            </>
          )}
          <span className="ml-1 text-gray-400">
            ·{" "}
            {new Date(entry.changedAt).toLocaleDateString("en", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

Legacy rows have `source === null`, so nothing extra is rendered for them.

- [ ] **Step 2: Verify the web app builds**

```bash
cd /Users/stephane/projects/saas/kanban && pnpm build
```

Expected: PASS for all packages, including `@kanban/web`.

- [ ] **Step 3: Commit**

```bash
cd /Users/stephane/projects/saas/kanban && pnpm format
git add "apps/web/src/app/(app)/orgs/[orgId]/projects/[projectId]/task-detail-sidebar/HistoryFeed.tsx"
git commit -m "feat(web): show change source in task history feed"
```

---

### Task 8: Full verification

- [ ] **Step 1: Run everything**

```bash
cd /Users/stephane/projects/saas/kanban
pnpm lint
pnpm build
cd apps/api && pnpm test
```

Expected: lint 0 errors, build succeeds for all packages, full API suite green.

- [ ] **Step 2: Sanity-check the migration against a real database**

```bash
cd /Users/stephane/projects/saas/kanban/apps/api && pnpm test src/tests/features/task-history.test.ts
```

Expected: PASS — this runs the committed migrations against a fresh in-memory DB, proving the
`ALTER TABLE` applies cleanly on top of the existing chain.

- [ ] **Step 3: Report**

Report the exact command output for lint, build and tests. If anything fails, fix it and re-run
before claiming completion.
