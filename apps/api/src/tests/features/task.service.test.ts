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

describe("TaskService.createTask", () => {
  it("returns a full TaskDto", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);
    expect(task.id).toBeTruthy();
    expect(task.title).toBe("Fix bug");
    expect(task.column).toBe("todo");
    expect(task.reporter.id).toBe(user.id);
    expect(task.reporter.displayName).toBe("Alice");
    expect(task.doer).toBeNull();
    expect(task.tags).toEqual([]);
    expect(task.linkedTaskIds).toEqual([]);
    testDb.close();
  });

  it("assigns sequential positions within the same column", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const t1 = taskSvc.createTask(project.id, user.id, {
      ...baseTask,
      title: "T1",
    });
    const t2 = taskSvc.createTask(project.id, user.id, {
      ...baseTask,
      title: "T2",
    });
    expect(t2.position).toBeGreaterThan(t1.position);
    testDb.close();
  });
});

describe("TaskService.getTask", () => {
  it("returns the task", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const created = taskSvc.createTask(project.id, user.id, baseTask);
    const found = taskSvc.getTask(created.id);
    expect(found?.title).toBe("Fix bug");
    testDb.close();
  });

  it("returns undefined for unknown id", async () => {
    const { taskSvc, testDb } = await setup();
    expect(taskSvc.getTask("nonexistent")).toBeUndefined();
    testDb.close();
  });
});

describe("TaskService.listTasks", () => {
  it("returns all tasks for the project", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    taskSvc.createTask(project.id, user.id, { ...baseTask, title: "A" });
    taskSvc.createTask(project.id, user.id, { ...baseTask, title: "B" });
    const list = taskSvc.listTasks(project.id);
    expect(list.length).toBe(2);
    testDb.close();
  });

  it("filters by search query across fields", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    taskSvc.createTask(project.id, user.id, {
      ...baseTask,
      title: "FOO in title",
    });
    taskSvc.createTask(project.id, user.id, {
      ...baseTask,
      description: "FOO in description",
    });
    taskSvc.createTask(project.id, user.id, {
      ...baseTask,
      globalSubject: "FOO in subject",
    });
    taskSvc.createTask(project.id, user.id, {
      ...baseTask,
      objective: "FOO in objective",
    });
    taskSvc.createTask(project.id, user.id, { ...baseTask, title: "No bar" });

    expect(taskSvc.listTasks(project.id, { search: "FOO" }).length).toBe(4);
    expect(taskSvc.listTasks(project.id, { search: "title" }).length).toBe(1);
    expect(
      taskSvc.listTasks(project.id, { search: "description" }).length,
    ).toBe(1);
    testDb.close();
  });

  it("sorts by endDate asc", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    taskSvc.createTask(project.id, user.id, {
      ...baseTask,
      title: "Late",
      endDate: "2026-12-31",
    });
    taskSvc.createTask(project.id, user.id, {
      ...baseTask,
      title: "Early",
      endDate: "2026-01-01",
    });
    taskSvc.createTask(project.id, user.id, {
      ...baseTask,
      title: "Middle",
      endDate: "2026-06-01",
    });

    const list = taskSvc.listTasks(project.id);
    expect(list[0]!.title).toBe("Early");
    expect(list[1]!.title).toBe("Middle");
    expect(list[2]!.title).toBe("Late");
    testDb.close();
  });
});

describe("TaskService.updateTask", () => {
  it("updates title and writes history", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const created = taskSvc.createTask(project.id, user.id, baseTask);
    const updated = taskSvc.updateTask(created.id, user.id, {
      title: "Fixed bug",
    });
    expect(updated.title).toBe("Fixed bug");
    const history = taskSvc.getTaskHistory(created.id);
    expect(history.length).toBe(1);
    expect(history[0]?.field).toBe("title");
    expect(history[0]?.oldValue).toBe("Fix bug");
    expect(history[0]?.newValue).toBe("Fixed bug");
    testDb.close();
  });

  it("groups multi-field update under same batchId", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const created = taskSvc.createTask(project.id, user.id, baseTask);
    taskSvc.updateTask(created.id, user.id, {
      title: "New",
      description: "Desc",
    });
    const history = taskSvc.getTaskHistory(created.id);
    expect(history.length).toBe(2);
    expect(history[0]?.batchId).toBe(history[1]?.batchId);
    expect(history[0]?.batchId).toBeTruthy();
    testDb.close();
  });

  it("skips unchanged fields in history", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const created = taskSvc.createTask(project.id, user.id, baseTask);
    taskSvc.updateTask(created.id, user.id, { title: "Fix bug" }); // same title
    expect(taskSvc.getTaskHistory(created.id).length).toBe(0);
    testDb.close();
  });
});

describe("TaskService.updateTask tag deltas", () => {
  async function setupTagged(tags: string[]) {
    const ctx = await setup();
    const created = ctx.taskSvc.createTask(ctx.project.id, ctx.user.id, {
      ...baseTask,
      tags,
    });
    return { ...ctx, created };
  }

  it("appends tags without touching existing ones", async () => {
    const { user, taskSvc, testDb, created } = await setupTagged(["api"]);
    const updated = taskSvc.updateTask(created.id, user.id, {
      addTags: ["mcp", "docs"],
    });
    expect(updated.tags).toEqual(["api", "mcp", "docs"]);
    testDb.close();
  });

  it("ignores duplicates when adding", async () => {
    const { user, taskSvc, testDb, created } = await setupTagged(["api"]);
    const updated = taskSvc.updateTask(created.id, user.id, {
      addTags: ["api", "mcp", "mcp"],
    });
    expect(updated.tags).toEqual(["api", "mcp"]);
    testDb.close();
  });

  it("removes only the listed tags", async () => {
    const { user, taskSvc, testDb, created } = await setupTagged([
      "api",
      "mcp",
      "docs",
    ]);
    const updated = taskSvc.updateTask(created.id, user.id, {
      removeTags: ["mcp", "absent"],
    });
    expect(updated.tags).toEqual(["api", "docs"]);
    testDb.close();
  });

  it("applies removals before additions when both are given", async () => {
    const { user, taskSvc, testDb, created } = await setupTagged([
      "api",
      "mcp",
    ]);
    const updated = taskSvc.updateTask(created.id, user.id, {
      removeTags: ["mcp"],
      addTags: ["mcp", "docs"],
    });
    expect(updated.tags).toEqual(["api", "mcp", "docs"]);
    testDb.close();
  });

  it("writes a tags history entry with old and new values", async () => {
    const { user, taskSvc, testDb, created } = await setupTagged(["api"]);
    taskSvc.updateTask(created.id, user.id, { addTags: ["mcp"] });
    const history = taskSvc.getTaskHistory(created.id);
    expect(history.length).toBe(1);
    expect(history[0]?.field).toBe("tags");
    expect(history[0]?.oldValue).toBe("api");
    expect(history[0]?.newValue).toBe("api, mcp");
    testDb.close();
  });

  it("writes no history when the tag set is unchanged", async () => {
    const { user, taskSvc, testDb, created } = await setupTagged(["api"]);
    taskSvc.updateTask(created.id, user.id, {
      addTags: ["api"],
      removeTags: ["absent"],
    });
    expect(taskSvc.getTaskHistory(created.id).length).toBe(0);
    testDb.close();
  });

  it("rejects combining tags with addTags or removeTags", async () => {
    const { user, taskSvc, testDb, created } = await setupTagged(["api"]);
    expect(() =>
      taskSvc.updateTask(created.id, user.id, {
        tags: ["x"],
        addTags: ["y"],
      }),
    ).toThrow(/tags/);
    expect(() =>
      taskSvc.updateTask(created.id, user.id, {
        tags: ["x"],
        removeTags: ["y"],
      }),
    ).toThrow(/tags/);
    testDb.close();
  });
});

describe("TaskService.deleteTask", () => {
  it("removes the task", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const created = taskSvc.createTask(project.id, user.id, baseTask);
    taskSvc.deleteTask(created.id);
    expect(taskSvc.getTask(created.id)).toBeUndefined();
    testDb.close();
  });
});
