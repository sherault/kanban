import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestDb } from "../../db/test-utils.js";
import { IdentityService } from "../../features/identity/identity.service.js";
import { OrganizationService } from "../../features/organization/organization.service.js";
import { ProjectService } from "../../features/project/project.service.js";
import { TaskService } from "../../features/task/task.service.js";
import { registerTaskCrudTools } from "../../features/mcp/mcp-server/task-crud-tools.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

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

/**
 * End-to-end PATCH semantics: the real zod schema, the real TaskService and a
 * real SQLite database. Anything omitted from the tool arguments must survive
 * the write untouched; only an explicit `null` may clear a nullable field.
 */
async function makeLiveHarness() {
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
  const other = await idSvc.register({
    email: "bob@example.com",
    password: "password123",
    displayName: "Bob",
  });
  const org = orgSvc.createOrg(user.id, { name: "Acme" });
  const project = projSvc.createProject(org.id, { name: "Sprint 1" });

  const tools = new Map<string, (input: any) => any>();
  const configs = new Map<string, any>();
  registerTaskCrudTools(
    {
      registerTool(name: string, config: unknown, handler: any) {
        tools.set(name, handler);
        configs.set(name, config);
      },
    } as any,
    taskSvc,
    user.id,
  );

  const schema = z.object(configs.get("update_task").inputSchema);
  const updateTask = (args: Record<string, unknown>) =>
    tools.get("update_task")!(schema.parse(args));

  const task = taskSvc.createTask(project.id, user.id, {
    title: "Original title",
    description: "Original description",
    objective: "Original objective",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    backgroundColor: "#f97316",
    globalSubject: "Original epic",
    doerId: user.id,
    validatorId: other.id,
    tags: ["alpha", "beta"],
  });

  return { testDb, taskSvc, task, user, other, schema, updateTask };
}

describe("update_task MCP tool patch semantics", () => {
  it("materializes no value for omitted keys when parsing arguments", async () => {
    const { testDb, schema } = await makeLiveHarness();

    const parsed = schema.parse({ taskId: "task-1", title: "Only title" });

    expect(Object.keys(parsed).sort()).toEqual(["taskId", "title"]);
    testDb.close();
  });

  it("leaves every other field untouched when only the title is sent", async () => {
    const { testDb, taskSvc, task, updateTask } = await makeLiveHarness();

    updateTask({ taskId: task.id, title: "Patched title" });

    const after = taskSvc.getTask(task.id)!;
    expect(after.title).toBe("Patched title");
    expect(after.description).toBe("Original description");
    expect(after.objective).toBe("Original objective");
    expect(after.startDate).toBe("2026-01-01");
    expect(after.endDate).toBe("2026-12-31");
    expect(after.backgroundColor).toBe("#f97316");
    expect(after.globalSubject).toBe("Original epic");
    expect(after.doer?.id).toBe(task.doer?.id);
    expect(after.validator?.id).toBe(task.validator?.id);
    expect(after.tags).toEqual(["alpha", "beta"]);
    expect(after.column).toBe(task.column);
    testDb.close();
  });

  it("leaves the other fields untouched when only a nullable field is patched", async () => {
    const { testDb, taskSvc, task, updateTask } = await makeLiveHarness();

    updateTask({ taskId: task.id, globalSubject: "Patched epic" });

    const after = taskSvc.getTask(task.id)!;
    expect(after.globalSubject).toBe("Patched epic");
    expect(after.title).toBe("Original title");
    expect(after.description).toBe("Original description");
    expect(after.objective).toBe("Original objective");
    expect(after.backgroundColor).toBe("#f97316");
    expect(after.doer?.id).toBe(task.doer?.id);
    expect(after.validator?.id).toBe(task.validator?.id);
    expect(after.tags).toEqual(["alpha", "beta"]);
    testDb.close();
  });

  it("keeps assignments when only tags are replaced", async () => {
    const { testDb, taskSvc, task, updateTask } = await makeLiveHarness();

    updateTask({ taskId: task.id, tags: ["gamma"] });

    const after = taskSvc.getTask(task.id)!;
    expect(after.tags).toEqual(["gamma"]);
    expect(after.title).toBe("Original title");
    expect(after.description).toBe("Original description");
    expect(after.doer?.id).toBe(task.doer?.id);
    expect(after.validator?.id).toBe(task.validator?.id);
    testDb.close();
  });

  it("still clears a nullable field when null is sent explicitly", async () => {
    const { testDb, taskSvc, task, updateTask } = await makeLiveHarness();

    updateTask({ taskId: task.id, description: null });

    const after = taskSvc.getTask(task.id)!;
    expect(after.description).toBeNull();
    expect(after.title).toBe("Original title");
    expect(after.objective).toBe("Original objective");
    expect(after.globalSubject).toBe("Original epic");
    expect(after.tags).toEqual(["alpha", "beta"]);
    testDb.close();
  });

  it("records history only for the field actually patched", async () => {
    const { testDb, taskSvc, task, updateTask } = await makeLiveHarness();

    updateTask({ taskId: task.id, title: "Patched title" });

    const history = taskSvc.getTaskHistory(task.id);
    expect(history.map((entry) => entry.field)).toEqual(["title"]);
    testDb.close();
  });
});
