# get_board MCP Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the kanban board as an MCP **tool** (`get_board`) — callable by sub-agents, which cannot `@`-mention the existing `kanban://projects/{id}/board` resource — enriched with tags, colour and due date.

**Architecture:** Extract the board render out of `resources.ts` into a pure `renderBoard()` function, then call it from two places: a new `get_board` tool registrar, and the existing resource handler. One render, two surfaces.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk` `McpServer`, `zod` for tool input schemas, Vitest.

Spec: `docs/superpowers/specs/2026-07-27-mcp-get-board-tool-design.md`

---

## File Structure

| File                                                            | Responsibility                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `apps/api/src/features/mcp/mcp-server/board-render.ts` (create) | Pure render: `TaskDto[]` → board text. No MCP, no service, no DB. |
| `apps/api/src/features/mcp/mcp-server/board-tools.ts` (create)  | Registers the `get_board` tool; argument plumbing only.           |
| `apps/api/src/tests/features/mcp-board-tools.test.ts` (create)  | Drives the render through the registered tool handler.            |
| `apps/api/src/features/mcp/mcp-server/resources.ts` (modify)    | Drops its inline render, calls `renderBoard`.                     |
| `apps/api/src/features/mcp/mcp.server.ts` (modify)              | Wires `registerBoardTools`.                                       |

Run all commands from `apps/api` unless stated otherwise.

---

### Task 1: `get_board` tool and board render

**Files:**

- Create: `apps/api/src/features/mcp/mcp-server/board-render.ts`
- Create: `apps/api/src/features/mcp/mcp-server/board-tools.ts`
- Test: `apps/api/src/tests/features/mcp-board-tools.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/tests/features/mcp-board-tools.test.ts`. The harness mirrors
`mcp-task-list-tools.test.ts`: a stub server that captures handlers into a `Map`, and a
stub `TaskService` exposing only `listTasks`.

```ts
import { describe, expect, it } from "vitest";
import { registerBoardTools } from "../../features/mcp/mcp-server/board-tools.js";

function makeHarness(tasks: any[] = []) {
  const tools = new Map<string, (input: any) => any>();

  const server = {
    registerTool(name: string, _config: unknown, handler: any) {
      tools.set(name, handler);
    },
  };

  const taskSvc = {
    listTasks(projectId: string) {
      return tasks.filter((task) => task.projectId === projectId);
    },
  };

  registerBoardTools(server as any, taskSvc as any);

  return { tools };
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    projectId: "project-1",
    column: "todo",
    title: "Ship get_board",
    endDate: "2026-07-28",
    backgroundColor: null,
    position: 0,
    tags: [],
    doer: null,
    ...overrides,
  };
}

function callBoard(tasks: any[], args: Record<string, unknown> = {}): string {
  const { tools } = makeHarness(tasks);
  const handler = tools.get("get_board")!;
  return handler({ projectId: "project-1", limitPerColumn: 50, ...args })
    .content[0].text;
}

describe("get_board", () => {
  it("renders all four columns with their totals, even when empty", () => {
    const text = callBoard([
      makeTask({ id: "t1", column: "todo" }),
      makeTask({ id: "t2", column: "todo" }),
      makeTask({ id: "t3", column: "doing" }),
    ]);

    expect(text).toContain("Board: project project-1");
    expect(text).toContain("## IDEAS (0)");
    expect(text).toContain("## TODO (2)");
    expect(text).toContain("## DOING (1)");
    expect(text).toContain("## DONE (0)");
  });

  it("groups each task under its own column", () => {
    const text = callBoard([
      makeTask({ id: "t1", column: "todo", title: "Todo task" }),
      makeTask({ id: "t2", column: "done", title: "Done task" }),
    ]);

    const todoIndex = text.indexOf("## TODO");
    const doneIndex = text.indexOf("## DONE");
    expect(text.indexOf("[t1] Todo task")).toBeGreaterThan(todoIndex);
    expect(text.indexOf("[t1] Todo task")).toBeLessThan(doneIndex);
    expect(text.indexOf("[t2] Done task")).toBeGreaterThan(doneIndex);
  });

  it("orders tasks inside a column by position ascending", () => {
    const text = callBoard([
      makeTask({ id: "t-c", position: 2 }),
      makeTask({ id: "t-a", position: 0 }),
      makeTask({ id: "t-b", position: 1 }),
    ]);

    expect(text.indexOf("[t-a]")).toBeLessThan(text.indexOf("[t-b]"));
    expect(text.indexOf("[t-b]")).toBeLessThan(text.indexOf("[t-c]"));
  });

  it("breaks a position tie by id so the render is deterministic", () => {
    const text = callBoard([
      makeTask({ id: "t-b", position: 0 }),
      makeTask({ id: "t-a", position: 0 }),
    ]);

    expect(text.indexOf("[t-a]")).toBeLessThan(text.indexOf("[t-b]"));
  });

  it("renders doer, due date, tags and colour in the documented order", () => {
    const text = callBoard([
      makeTask({
        id: "t1",
        title: "Fix auth bug",
        doer: { id: "u1", displayName: "alice" },
        endDate: "2026-08-01",
        tags: ["bug", "api"],
        backgroundColor: "#ff0000",
      }),
    ]);

    expect(text).toContain(
      "- [t1] Fix auth bug [@alice] due:2026-08-01 #bug #api ^#ff0000",
    );
  });

  it("omits doer, tags and colour when they are absent", () => {
    const text = callBoard([
      makeTask({ id: "t1", title: "Write docs", endDate: "2026-08-15" }),
    ]);

    expect(text).toContain("- [t1] Write docs due:2026-08-15");
  });

  it("keeps only the date part of endDate", () => {
    const text = callBoard([
      makeTask({ id: "t1", endDate: "2026-08-15 09:30:00" }),
    ]);

    expect(text).toContain("due:2026-08-15");
    expect(text).not.toContain("09:30:00");
  });

  it("truncates a column at limitPerColumn but keeps the full count in the header", () => {
    const tasks = Array.from({ length: 5 }, (_, index) =>
      makeTask({ id: `t${index}`, position: index }),
    );

    const text = callBoard(tasks, { limitPerColumn: 2 });

    expect(text).toContain("## TODO (5)");
    expect(text).toContain("[t0]");
    expect(text).toContain("[t1]");
    expect(text).not.toContain("[t2]");
    expect(text).toContain("- … 3 more (use list_tasks)");
  });

  it("renders an empty board for a project with no tasks", () => {
    const text = callBoard([]);

    expect(text).toContain("## IDEAS (0)");
    expect(text).toContain("## TODO (0)");
    expect(text).toContain("## DOING (0)");
    expect(text).toContain("## DONE (0)");
    expect(text).not.toContain("more (use list_tasks)");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm vitest run src/tests/features/mcp-board-tools.test.ts`

Expected: FAIL — the suite cannot resolve `../../features/mcp/mcp-server/board-tools.js`.

- [ ] **Step 3: Write the render**

Create `apps/api/src/features/mcp/mcp-server/board-render.ts`:

```ts
import type { TaskDto } from "@kanban/shared";
import { COLUMN_VALUES } from "./utils.js";

export const DEFAULT_LIMIT_PER_COLUMN = 50;

function renderTask(task: TaskDto): string {
  const parts = [`- [${task.id}] ${task.title}`];
  if (task.doer) parts.push(`[@${task.doer.displayName}]`);
  parts.push(`due:${task.endDate.slice(0, 10)}`);
  if (task.tags.length) parts.push(task.tags.map((tag) => `#${tag}`).join(" "));
  if (task.backgroundColor) parts.push(`^${task.backgroundColor}`);
  return parts.join(" ");
}

/**
 * Renders a project board as compact text: one section per column, one line per
 * task. Shared by the get_board tool and the kanban://projects/{id}/board resource.
 */
export function renderBoard(
  tasks: TaskDto[],
  projectId: string,
  limitPerColumn: number,
): string {
  const lines: string[] = [`Board: project ${projectId}`, ""];

  for (const column of COLUMN_VALUES) {
    const columnTasks = tasks
      .filter((task) => task.column === column)
      .sort(
        (left, right) =>
          left.position - right.position || left.id.localeCompare(right.id),
      );

    lines.push(`## ${column.toUpperCase()} (${columnTasks.length})`);
    for (const task of columnTasks.slice(0, limitPerColumn)) {
      lines.push(renderTask(task));
    }

    const hidden = columnTasks.length - limitPerColumn;
    if (hidden > 0) lines.push(`- … ${hidden} more (use list_tasks)`);

    lines.push("");
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Write the tool registrar**

Create `apps/api/src/features/mcp/mcp-server/board-tools.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TaskService } from "../../task/task.service.js";
import { DEFAULT_LIMIT_PER_COLUMN, renderBoard } from "./board-render.js";
import { textResult } from "./utils.js";

export function registerBoardTools(server: McpServer, taskSvc: TaskService) {
  server.registerTool(
    "get_board",
    {
      description:
        "Full board snapshot in one call — every column with each task's doer, deadline, tags and colour. Use this at session start instead of several paginated list_tasks calls. Archived tasks are excluded.",
      inputSchema: {
        projectId: z.string().describe("Project ID"),
        limitPerColumn: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(DEFAULT_LIMIT_PER_COLUMN)
          .describe("Max tasks rendered per column (1-200, default 50)"),
      },
    },
    ({ projectId, limitPerColumn }) =>
      textResult(
        renderBoard(taskSvc.listTasks(projectId), projectId, limitPerColumn),
      ),
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/api && pnpm vitest run src/tests/features/mcp-board-tools.test.ts`

Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/features/mcp/mcp-server/board-render.ts \
        apps/api/src/features/mcp/mcp-server/board-tools.ts \
        apps/api/src/tests/features/mcp-board-tools.test.ts
git commit -m "feat(mcp): add get_board tool rendering the whole board in one call"
```

---

### Task 2: Reuse the render in the board resource

The resource keeps working exactly as before, minus its own copy of the render, and
gains tags, colour and due date for free.

**Files:**

- Modify: `apps/api/src/features/mcp/mcp-server/resources.ts` (whole file replaced)

- [ ] **Step 1: Replace the resource's inline render**

Rewrite `apps/api/src/features/mcp/mcp-server/resources.ts` as:

```ts
import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskService } from "../../task/task.service.js";
import { DEFAULT_LIMIT_PER_COLUMN, renderBoard } from "./board-render.js";

export function registerMcpResources(server: McpServer, taskSvc: TaskService) {
  server.resource(
    "board",
    new ResourceTemplate("kanban://projects/{projectId}/board", {
      list: undefined,
    }),
    (_uri, { projectId }) => {
      const id = String(projectId);
      return {
        contents: [
          {
            uri: `kanban://projects/${id}/board`,
            text: renderBoard(
              taskSvc.listTasks(id),
              id,
              DEFAULT_LIMIT_PER_COLUMN,
            ),
            mimeType: "text/plain",
          },
        ],
      };
    },
  );
}
```

- [ ] **Step 2: Verify the whole API suite still passes**

Run: `cd apps/api && pnpm vitest run`

Expected: PASS, no failures. Nothing asserts on the old resource text, so no test
should need updating; if one does fail, it is asserting on the render and must be
updated to the new format rather than the render reverted.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/mcp/mcp-server/resources.ts
git commit -m "refactor(mcp): render the board resource through renderBoard"
```

---

### Task 3: Register the tool on the MCP server

Until this task the tool exists but no live server exposes it.

**Files:**

- Modify: `apps/api/src/features/mcp/mcp.server.ts:7-15` (imports) and `:35-43` (registration)

- [ ] **Step 1: Add the import**

In `apps/api/src/features/mcp/mcp.server.ts`, add this line to the import block,
keeping the existing alphabetical order — it goes immediately before the
`registerMcpResources` import on line 7:

```ts
import { registerBoardTools } from "./mcp-server/board-tools.js";
```

- [ ] **Step 2: Register the tool**

In the same file, add this line directly after `registerTaskListTools(server, taskSvc);`:

```ts
registerBoardTools(server, taskSvc);
```

- [ ] **Step 3: Verify typecheck, lint and tests**

Run, from the repo root:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: all three succeed, no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/features/mcp/mcp.server.ts
git commit -m "feat(mcp): register get_board on the MCP server"
```

---

## Verification

After Task 3, `get_board` is live. Manual check against a running API is optional; the
suite covers the render, and Task 3's typecheck covers the wiring.
