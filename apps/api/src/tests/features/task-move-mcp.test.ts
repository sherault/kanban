import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb } from "../../db/test-utils.js";
import { IdentityService } from "../../features/identity/identity.service.js";
import { OrganizationService } from "../../features/organization/organization.service.js";
import { ProjectService } from "../../features/project/project.service.js";
import { TaskService } from "../../features/task/task.service.js";

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

  return { testDb, user, org, project, taskSvc };
}

const baseTask = {
  title: "Fix bug",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
};

describe("TaskService.moveTask from MCP", () => {
  it("refuses to move to doing when no doer is assigned", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);

    expect(() =>
      taskSvc.moveTask(task.id, user.id, { column: "doing" }, true),
    ).toThrow(/doer/i);

    expect(taskSvc.getTask(task.id)?.column).toBe("todo");
    expect(taskSvc.getTaskHistory(task.id).length).toBe(0);
    testDb.close();
  });

  it("does not auto-assign the actor as doer when moving to doing", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);
    taskSvc.updateTask(task.id, user.id, { doerId: user.id });
    const historyBefore = taskSvc.getTaskHistory(task.id).length;

    const moved = taskSvc.moveTask(task.id, user.id, { column: "doing" }, true);

    expect(moved.column).toBe("doing");
    expect(moved.doer?.id).toBe(user.id);

    // only the column change is recorded — no implicit doer write
    const history = taskSvc.getTaskHistory(task.id);
    expect(history.length).toBe(historyBefore + 1);
    expect(history.filter((h) => h.field === "column").length).toBe(1);
    testDb.close();
  });

  it("does not clear the doer when moving to todo or ideas", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);
    taskSvc.updateTask(task.id, user.id, { doerId: user.id });

    const toTodo = taskSvc.moveTask(task.id, user.id, { column: "todo" }, true);
    expect(toTodo.doer?.id).toBe(user.id);

    const toIdeas = taskSvc.moveTask(
      task.id,
      user.id,
      { column: "ideas" },
      true,
    );
    expect(toIdeas.doer?.id).toBe(user.id);
    testDb.close();
  });

  it("still records column history", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);

    taskSvc.moveTask(task.id, user.id, { column: "done" }, true);

    const history = taskSvc.getTaskHistory(task.id);
    expect(history.some((h) => h.field === "column")).toBe(true);
    testDb.close();
  });

  it("keeps auto doer behaviour for non-MCP moves", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);

    const doing = taskSvc.moveTask(task.id, user.id, { column: "doing" });
    expect(doing.doer?.id).toBe(user.id);

    const todo = taskSvc.moveTask(task.id, user.id, { column: "todo" });
    expect(todo.doer).toBeNull();
    testDb.close();
  });
});
