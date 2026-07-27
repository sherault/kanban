import { describe, expect, it } from "vitest";
import { registerTaskListTools } from "../../features/mcp/mcp-server/task-list-tools.js";

function parseToolResult(result: any) {
  return JSON.parse(result.content[0].text);
}

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

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    projectId: "project-1",
    column: "todo",
    title: "Ship get_task",
    description: null,
    objective: null,
    startDate: "2026-07-27",
    endDate: "2026-07-28",
    tags: ["mcp"],
    linkedTaskIds: [],
    archivedAt: null,
    doer: null,
    validator: null,
    ...overrides,
  };
}

function listArgs(overrides: Record<string, unknown> = {}) {
  return { projectId: "project-1", page: 1, limit: 10, ...overrides };
}

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

describe("get_task MCP tool", () => {
  it("returns the full task DTO for a known task ID", () => {
    const task = makeTask();
    const { tools } = makeHarness([task]);
    const getTask = tools.get("get_task");
    expect(getTask).toBeDefined();

    const result = parseToolResult(getTask!({ taskId: "task-1" }));

    expect(result).toEqual(task);
  });

  it("returns an error result when the task does not exist", () => {
    const { tools } = makeHarness([]);
    const getTask = tools.get("get_task");

    const result = getTask!({ taskId: "missing" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Task not found");
  });

  it("flags archived tasks with an explicit archived marker", () => {
    const task = makeTask({ archivedAt: "2026-07-20T10:00:00.000Z" });
    const { tools } = makeHarness([task]);
    const getTask = tools.get("get_task");

    const result = parseToolResult(getTask!({ taskId: "task-1" }));

    expect(result.archived).toBe(true);
    expect(result.archivedAt).toBe("2026-07-20T10:00:00.000Z");
  });

  it("does not add the archived marker to active tasks", () => {
    const { tools } = makeHarness([makeTask()]);
    const getTask = tools.get("get_task");

    const result = parseToolResult(getTask!({ taskId: "task-1" }));

    expect(result.archived).toBeUndefined();
  });
});

describe("list_tasks MCP tool", () => {
  it("filters by tags with AND semantics", () => {
    const both = makeTask({ id: "both", tags: ["mcp", "urgent"] });
    const one = makeTask({ id: "one", tags: ["mcp"] });
    const none = makeTask({ id: "none", tags: [] });
    const { tools } = makeHarness([both, one, none]);

    const result = parseToolResult(
      tools.get("list_tasks")!(listArgs({ tags: ["mcp", "urgent"] })),
    );

    expect(result.tasks.map((task: any) => task.id)).toEqual(["both"]);
    expect(result.pagination.total).toBe(1);
  });

  it("still honours the deprecated singular tag key", () => {
    const tagged = makeTask({ id: "tagged", tags: ["mcp"] });
    const other = makeTask({ id: "other", tags: ["docs"] });
    const { tools } = makeHarness([tagged, other]);

    const result = parseToolResult(
      tools.get("list_tasks")!(listArgs({ tag: "mcp" })),
    );

    expect(result.tasks.map((task: any) => task.id)).toEqual(["tagged"]);
  });

  it("combines the deprecated tag key with tags using AND", () => {
    const both = makeTask({ id: "both", tags: ["mcp", "urgent"] });
    const one = makeTask({ id: "one", tags: ["mcp"] });
    const { tools } = makeHarness([both, one]);

    const result = parseToolResult(
      tools.get("list_tasks")!(listArgs({ tag: "urgent", tags: ["mcp"] })),
    );

    expect(result.tasks.map((task: any) => task.id)).toEqual(["both"]);
  });

  it("filters by validatorId", () => {
    const mine = makeTask({ id: "mine", validator: { id: "user-1" } });
    const other = makeTask({ id: "other", validator: { id: "user-2" } });
    const unset = makeTask({ id: "unset" });
    const { tools } = makeHarness([mine, other, unset]);

    const result = parseToolResult(
      tools.get("list_tasks")!(listArgs({ validatorId: "user-1" })),
    );

    expect(result.tasks.map((task: any) => task.id)).toEqual(["mine"]);
  });

  it("accepts a limit of up to 50", () => {
    const tasks = Array.from({ length: 60 }, (_, index) =>
      makeTask({ id: `task-${index}` }),
    );
    const { tools } = makeHarness(tasks);

    const result = parseToolResult(
      tools.get("list_tasks")!(listArgs({ limit: 50 })),
    );

    expect(result.tasks).toHaveLength(50);
    expect(result.pagination.totalPages).toBe(2);
  });
});

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
