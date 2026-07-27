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
