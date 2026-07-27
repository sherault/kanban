import { describe, expect, it } from "vitest";
import { registerTaskCrudTools } from "../../features/mcp/mcp-server/task-crud-tools.js";

function makeHarness() {
  const tools = new Map<string, (input: any) => any>();
  const configs = new Map<string, any>();
  const updateCalls: any[] = [];
  const appendCalls: any[] = [];

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
    appendTaskNote(taskId: string, userId: string, text: string) {
      appendCalls.push({ taskId, userId, text });
      return { id: taskId, description: text };
    },
  };

  registerTaskCrudTools(server as any, taskSvc as any, "user-1");

  return { tools, configs, updateCalls, appendCalls };
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

describe("append_task_note MCP tool", () => {
  it("is registered with taskId and text inputs", () => {
    const { configs } = makeHarness();
    const schema = configs.get("append_task_note").inputSchema;

    expect(schema.taskId).toBeDefined();
    expect(schema.text).toBeDefined();
  });

  it("forwards the note to the task service with the MCP user id", () => {
    const { tools, appendCalls } = makeHarness();

    tools.get("append_task_note")!({ taskId: "task-1", text: "Progress" });

    expect(appendCalls[0]).toEqual({
      taskId: "task-1",
      userId: "user-1",
      text: "Progress",
    });
  });

  it("returns the updated task as JSON text", () => {
    const { tools } = makeHarness();

    const result = tools.get("append_task_note")!({
      taskId: "task-1",
      text: "Progress",
    });

    expect(JSON.parse(result.content[0].text).id).toBe("task-1");
  });
});
