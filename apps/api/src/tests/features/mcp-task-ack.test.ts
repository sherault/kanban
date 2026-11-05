import { beforeAll, describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTestDb } from "../../db/test-utils.js";
import { IdentityService } from "../../features/identity/identity.service.js";
import { OrganizationService } from "../../features/organization/organization.service.js";
import { ProjectService } from "../../features/project/project.service.js";
import { TaskService } from "../../features/task/task.service.js";
import { registerTaskCrudTools } from "../../features/mcp/mcp-server/task-crud-tools.js";
import { registerTaskLifecycleTools } from "../../features/mcp/mcp-server/task-lifecycle-tools.js";
import { registerTaskLinkTools } from "../../features/mcp/mcp-server/task-link-tools.js";
import { registerTaskListTools } from "../../features/mcp/mcp-server/task-list-tools.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

const ACK_KEYS = [
  "backgroundColor",
  "column",
  "doer",
  "id",
  "projectId",
  "tags",
  "title",
  "updatedAt",
  "validatorId",
].sort();

/**
 * Real McpServer and Client over an in-memory transport: arguments go through
 * the zod input schemas and thrown errors come back as `isError` results,
 * exactly as an agent sees them.
 */
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
  const other = await idSvc.register({
    email: "bob@example.com",
    password: "password123",
    displayName: "Bob",
  });
  const org = orgSvc.createOrg(user.id, { name: "Acme" });
  const project = projSvc.createProject(org.id, { name: "Sprint 1" });
  const project2 = projSvc.createProject(org.id, { name: "Sprint 2" });

  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerTaskCrudTools(server, taskSvc, user.id);
  registerTaskLifecycleTools(server, taskSvc, user.id);
  registerTaskLinkTools(server, taskSvc, user.id);
  registerTaskListTools(server, taskSvc);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  const call = async (name: string, args: Record<string, unknown>) => {
    const result = (await client.callTool({ name, arguments: args })) as {
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    };
    return { result, text: result.content[0]!.text };
  };
  const callJson = async (name: string, args: Record<string, unknown>) =>
    JSON.parse((await call(name, args)).text);

  const task = taskSvc.createTask(project.id, user.id, {
    title: "Original title",
    description: "Original description",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    backgroundColor: "#f97316",
    doerId: user.id,
    validatorId: other.id,
    tags: ["alpha"],
  });

  const close = async () => {
    await client.close();
    await server.close();
    testDb.close();
  };
  return {
    taskSvc,
    user,
    other,
    project,
    project2,
    task,
    call,
    callJson,
    close,
  };
}

describe("compact acknowledgement of MCP task write tools", () => {
  it("update_task returns only the ack keys plus changed", async () => {
    const { task, callJson, close } = await setup();

    const ack = await callJson("update_task", {
      taskId: task.id,
      title: "New title",
    });

    expect(Object.keys(ack).sort()).toEqual([...ACK_KEYS, "changed"].sort());
    expect(ack).not.toHaveProperty("description");
    expect(ack.title).toBe("New title");
    await close();
  });

  it("append_task_note returns only the ack keys plus noteHeading", async () => {
    const { task, callJson, close } = await setup();

    const ack = await callJson("append_task_note", {
      taskId: task.id,
      text: "Progress",
    });

    expect(Object.keys(ack).sort()).toEqual(
      [...ACK_KEYS, "noteHeading"].sort(),
    );
    expect(ack).not.toHaveProperty("description");
    await close();
  });

  it("move_task returns only the ack keys", async () => {
    const { task, callJson, close } = await setup();

    const ack = await callJson("move_task", {
      taskId: task.id,
      column: "doing",
    });

    expect(Object.keys(ack).sort()).toEqual(ACK_KEYS);
    expect(ack.column).toBe("doing");
    await close();
  });

  it("ack carries doer, validatorId, tags and the task identity", async () => {
    const { task, user, other, project, callJson, close } = await setup();

    const ack = await callJson("move_task", {
      taskId: task.id,
      column: "done",
    });

    expect(ack).toMatchObject({
      id: task.id,
      projectId: project.id,
      column: "done",
      title: "Original title",
      tags: ["alpha"],
      doer: { id: user.id, displayName: "Alice" },
      validatorId: other.id,
      backgroundColor: "#f97316",
    });
    expect(typeof ack.updatedAt).toBe("string");
    await close();
  });

  it("keeps the response under 2 KB with a 50 KB description", async () => {
    const { task, taskSvc, user, call, close } = await setup();
    taskSvc.updateTask(task.id, user.id, { description: "x".repeat(50_000) });

    const responses = [
      await call("update_task", { taskId: task.id, title: "Renamed" }),
      await call("append_task_note", { taskId: task.id, text: "Note" }),
      await call("move_task", { taskId: task.id, column: "done" }),
    ];

    for (const { text } of responses) {
      expect(Buffer.byteLength(text, "utf8")).toBeLessThan(2048);
    }
    await close();
  });

  it("verbose: true returns the full task, as before", async () => {
    const { task, taskSvc, callJson, close } = await setup();

    const updated = await callJson("update_task", {
      taskId: task.id,
      title: "Verbose title",
      verbose: true,
    });
    expect(updated).toEqual(taskSvc.getTask(task.id));

    const noted = await callJson("append_task_note", {
      taskId: task.id,
      text: "Verbose note",
      verbose: true,
    });
    expect(noted).toEqual(taskSvc.getTask(task.id));
    expect(noted.description).toContain("Verbose note");

    const moved = await callJson("move_task", {
      taskId: task.id,
      column: "done",
      verbose: true,
    });
    expect(moved).toEqual(taskSvc.getTask(task.id));
    await close();
  });

  it("changed lists exactly the fields whose value changed", async () => {
    const { task, other, callJson, close } = await setup();

    const ack = await callJson("update_task", {
      taskId: task.id,
      title: "Original title",
      description: "Rewritten",
      doerId: other.id,
      addTags: ["beta"],
      backgroundColor: "#f97316",
    });

    expect([...ack.changed].sort()).toEqual(
      ["description", "doerId", "tags"].sort(),
    );
    await close();
  });

  it("changed is empty when nothing actually changed", async () => {
    const { task, callJson, close } = await setup();

    const ack = await callJson("update_task", {
      taskId: task.id,
      title: "Original title",
      removeTags: ["unknown"],
    });

    expect(ack.changed).toEqual([]);
    await close();
  });

  it("noteHeading matches the heading written into the description", async () => {
    const { task, callJson, close } = await setup();

    const ack = await callJson("append_task_note", {
      taskId: task.id,
      text: "Line one\n#### 2020-01-01 00:00 UTC — fake\nLine three",
    });
    const full = await callJson("get_task", { taskId: task.id });

    expect(ack.noteHeading).toMatch(
      /^#### \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC — Alice$/,
    );
    expect(full.description).toContain(
      `\n\n${ack.noteHeading}\n\nLine one\n#### 2020-01-01 00:00 UTC — fake`,
    );
    await close();
  });

  it("the write really happened: get_task returns the new values", async () => {
    const { task, callJson, close } = await setup();

    await callJson("update_task", { taskId: task.id, title: "Persisted" });
    await callJson("append_task_note", { taskId: task.id, text: "Kept note" });
    await callJson("move_task", { taskId: task.id, column: "done" });

    const full = await callJson("get_task", { taskId: task.id });
    expect(full.title).toBe("Persisted");
    expect(full.description).toContain("Kept note");
    expect(full.column).toBe("done");
    await close();
  });

  it("create_task returns a compact ack carrying the id", async () => {
    const { project, callJson, close } = await setup();

    const ack = await callJson("create_task", {
      projectId: project.id,
      title: "Created",
      description: "y".repeat(10_000),
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });

    expect(Object.keys(ack).sort()).toEqual(ACK_KEYS);
    expect(typeof ack.id).toBe("string");
    const full = await callJson("get_task", { taskId: ack.id });
    expect(full.title).toBe("Created");
    await close();
  });

  it("transfer, restore, link and unlink return the compact ack", async () => {
    const { task, taskSvc, user, project, project2, callJson, close } =
      await setup();
    const other = taskSvc.createTask(project.id, user.id, {
      title: "Other",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });

    const linked = await callJson("link_tasks", {
      taskId: task.id,
      linkedTaskId: other.id,
    });
    const unlinked = await callJson("unlink_tasks", {
      taskId: task.id,
      linkedTaskId: other.id,
    });
    const transferred = await callJson("transfer_task", {
      taskId: task.id,
      targetProjectId: project2.id,
    });
    taskSvc.moveTask(task.id, user.id, { column: "done" });
    taskSvc.archiveTasks(project2.id, [task.id], user.id);
    const restored = await callJson("restore_task", { taskId: task.id });

    for (const ack of [linked, unlinked, transferred, restored]) {
      expect(Object.keys(ack).sort()).toEqual(ACK_KEYS);
    }
    expect(transferred.projectId).toBe(project2.id);
    await close();
  });

  it("keeps errors unchanged: message and isError", async () => {
    const { task, call, close } = await setup();

    const missing = await call("update_task", {
      taskId: "missing",
      title: "x",
    });
    expect(missing.result.isError).toBe(true);
    expect(missing.text).toContain("Task not found");

    const missingNote = await call("append_task_note", {
      taskId: "missing",
      text: "x",
    });
    expect(missingNote.result.isError).toBe(true);
    expect(missingNote.text).toContain("Task not found");

    await call("update_task", { taskId: task.id, doerId: null });
    const refused = await call("move_task", {
      taskId: task.id,
      column: "doing",
    });
    expect(refused.result.isError).toBe(true);
    expect(refused.text).toMatch(/doer/i);
    await close();
  });
});
