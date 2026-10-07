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

describe("TaskService.searchTasksInOrg", () => {
  it("finds a task by its full id", async () => {
    const { user, org, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);
    taskSvc.createTask(project.id, user.id, { ...baseTask, title: "Other" });

    const results = taskSvc.searchTasksInOrg(org.id, task.id);

    expect(results.map((t) => t.id)).toEqual([task.id]);
    testDb.close();
  });

  it("finds a task by an id prefix", async () => {
    const { user, org, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);

    const results = taskSvc.searchTasksInOrg(org.id, task.id.slice(0, 6));

    expect(results.map((t) => t.id)).toContain(task.id);
    testDb.close();
  });

  it("matches the id prefix case-insensitively", async () => {
    const { user, org, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);

    const results = taskSvc.searchTasksInOrg(
      org.id,
      task.id.slice(0, 8).toUpperCase(),
    );

    expect(results.map((t) => t.id)).toContain(task.id);
    testDb.close();
  });
});
