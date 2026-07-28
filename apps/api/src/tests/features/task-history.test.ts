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
});

// changedAt only has second precision and ties break on a random id, so these
// tests match entries by their values rather than by position.
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
    const byNote = new Map(
      notes.map((entry) => [entry.newValue, entry.source]),
    );
    expect(byNote.get("web note")).toBe("web");
    expect(byNote.get("mcp note")).toBe("mcp");
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

  it("records the source of a column move", async () => {
    const { testDb, user, task, taskSvc } = await setup();

    taskSvc.moveTask(task.id, user.id, { column: "done" });

    const moveEntry = taskSvc
      .getTaskHistory(task.id)
      .find((entry) => entry.field === "column");
    expect(moveEntry?.source).toBe("web");
    testDb.close();
  });

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
});
