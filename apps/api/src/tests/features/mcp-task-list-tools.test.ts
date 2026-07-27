import { describe, expect, it } from "vitest";
import { registerTaskListTools } from "../../features/mcp/mcp-server/task-list-tools.js";

function parseToolResult(result: any) {
  return JSON.parse(result.content[0].text);
}

function makeHarness(tasks: any[] = []) {
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
    ...overrides,
  };
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
