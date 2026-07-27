import { describe, expect, it } from "vitest";
import { registerTaskCrudTools } from "../../features/mcp/mcp-server/task-crud-tools.js";

function makeHarness() {
  const tools = new Map<string, (input: any) => any>();
  const configs = new Map<string, any>();
  const updateCalls: any[] = [];

  const server = {
    registerTool(name: string, config: unknown, handler: any) {
      tools.set(name, handler);
      configs.set(name, config);
    },
  };

  const taskSvc = {
    createTask: () => ({}),
    deleteTask: () => undefined,
    updateTask(taskId: string, userId: string, fields: any, isMcp: boolean) {
      updateCalls.push({ taskId, userId, fields, isMcp });
      return { id: taskId, ...fields };
    },
  };

  registerTaskCrudTools(server as any, taskSvc as any, "user-1");

  return { tools, configs, updateCalls };
}

describe("update_task MCP tool tag deltas", () => {
  it("exposes addTags and removeTags in its input schema", () => {
    const { configs } = makeHarness();
    const schema = configs.get("update_task").inputSchema;

    expect(schema.addTags).toBeDefined();
    expect(schema.removeTags).toBeDefined();
    expect(schema.tags).toBeDefined();
  });

  it("forwards addTags and removeTags to the task service", () => {
    const { tools, updateCalls } = makeHarness();

    tools.get("update_task")!({
      taskId: "task-1",
      addTags: ["mcp"],
      removeTags: ["stale"],
    });

    expect(updateCalls[0].taskId).toBe("task-1");
    expect(updateCalls[0].fields).toEqual({
      addTags: ["mcp"],
      removeTags: ["stale"],
    });
    expect(updateCalls[0].isMcp).toBe(true);
  });

  it("leaves tag fields untouched when none are provided", () => {
    const { tools, updateCalls } = makeHarness();

    tools.get("update_task")!({ taskId: "task-1", title: "New" });

    expect(updateCalls[0].fields).toEqual({ title: "New" });
  });
});
