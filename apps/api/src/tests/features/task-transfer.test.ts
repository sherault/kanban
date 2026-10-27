import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb } from "../../db/test-utils.js";
import { IdentityService } from "../../features/identity/identity.service.js";
import { OrganizationService } from "../../features/organization/organization.service.js";
import { ProjectService } from "../../features/project/project.service.js";
import { TaskService } from "../../features/task/task.service.js";
import type { Broadcaster } from "../../types.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

async function setup() {
  const testDb = createTestDb();
  const events: Array<{ room: string; event: any }> = [];
  const broadcast: Broadcaster = (room, event) => {
    events.push({ room, event });
  };
  const idSvc = new IdentityService(testDb.db);
  const orgSvc = new OrganizationService(testDb.db);
  const projSvc = new ProjectService(testDb.db);
  const taskSvc = new TaskService(testDb.db, broadcast);

  const user = await idSvc.register({
    email: "alice@example.com",
    password: "password123",
    displayName: "Alice",
  });
  const org = orgSvc.createOrg(user.id, { name: "Acme" });
  const source = projSvc.createProject(org.id, { name: "Source" });
  const target = projSvc.createProject(org.id, { name: "Target" });

  return {
    testDb,
    idSvc,
    orgSvc,
    projSvc,
    user,
    org,
    source,
    target,
    taskSvc,
    events,
  };
}

const baseTask = {
  title: "Fix bug",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
};

describe("TaskService.transferTask", () => {
  it("moves the task to the target project keeping id, column, data and history", async () => {
    const { user, source, target, taskSvc, testDb } = await setup();
    const linked = taskSvc.createTask(source.id, user.id, baseTask);
    const task = taskSvc.createTask(source.id, user.id, {
      ...baseTask,
      description: "desc",
      tags: ["a", "b"],
    });
    taskSvc.updateTask(task.id, user.id, { doerId: user.id });
    taskSvc.moveTask(task.id, user.id, { column: "doing" });
    taskSvc.addWatcher(task.id, user.id, user.id);
    taskSvc.addLink(task.id, linked.id, user.id);
    const historyBefore = taskSvc.getTaskHistory(task.id);

    const moved = taskSvc.transferTask(task.id, user.id, {
      targetProjectId: target.id,
    });

    expect(moved.id).toBe(task.id);
    expect(moved.projectId).toBe(target.id);
    expect(moved.projectName).toBe("Target");
    expect(moved.column).toBe("doing");
    expect(moved.description).toBe("desc");
    expect(moved.tags).toEqual(["a", "b"]);
    expect(moved.doer?.id).toBe(user.id);
    expect(moved.watchers.map((w) => w.id)).toEqual([user.id]);
    expect(moved.linkedTaskIds).toEqual([linked.id]);
    expect(moved.reporter.id).toBe(user.id);
    expect(moved.createdAt).toBe(task.createdAt);

    const history = taskSvc.getTaskHistory(task.id);
    expect(history.length).toBe(historyBefore.length + 1);
    const entry = history.find((h) => h.field === "projectId")!;
    expect(entry.oldValue).toBe(source.id);
    expect(entry.newValue).toBe(target.id);
    expect(entry.source).toBe("web");
    expect(entry.actor.id).toBe(user.id);
    testDb.close();
  });

  it("puts the task at the end of its column in the target project", async () => {
    const { user, source, target, taskSvc, testDb } = await setup();
    taskSvc.createTask(target.id, user.id, baseTask);
    const last = taskSvc.createTask(target.id, user.id, baseTask);
    const task = taskSvc.createTask(source.id, user.id, baseTask);

    const moved = taskSvc.transferTask(task.id, user.id, {
      targetProjectId: target.id,
    });

    expect(moved.position).toBeGreaterThan(last.position);
    expect(taskSvc.listTasks(target.id).map((t) => t.id)).toContain(task.id);
    expect(taskSvc.listTasks(source.id).map((t) => t.id)).not.toContain(
      task.id,
    );
    testDb.close();
  });

  it("transfers an archived task, which stays archived in the target project", async () => {
    const { user, source, target, taskSvc, events, testDb } = await setup();
    const task = taskSvc.createTask(source.id, user.id, baseTask);
    taskSvc.moveTask(task.id, user.id, { column: "done" });
    taskSvc.archiveTasks(source.id, [task.id], user.id);
    const archivedAt = taskSvc.getTask(task.id)!.archivedAt;
    events.length = 0;

    const moved = taskSvc.transferTask(
      task.id,
      user.id,
      { targetProjectId: target.id },
      true,
    );

    expect(moved.archivedAt).toBe(archivedAt);
    expect(moved.column).toBe("done");
    expect(taskSvc.listArchivedTasks(target.id).tasks.map((t) => t.id)).toEqual(
      [task.id],
    );
    expect(taskSvc.listArchivedTasks(source.id).total).toBe(0);
    expect(
      taskSvc.getTaskHistory(task.id).find((h) => h.field === "projectId")
        ?.source,
    ).toBe("mcp");
    // archived tasks are on no board: nothing to tell board viewers
    expect(events).toEqual([]);
    testDb.close();
  });

  it("broadcasts a removal on the source board and a creation on the target board", async () => {
    const { user, source, target, taskSvc, events, testDb } = await setup();
    const task = taskSvc.createTask(source.id, user.id, baseTask);
    events.length = 0;

    taskSvc.transferTask(task.id, user.id, { targetProjectId: target.id });

    expect(events.map((e) => [e.room, e.event.type])).toEqual([
      [`project:${source.id}`, "task.deleted"],
      [`project:${target.id}`, "task.created"],
    ]);
    expect(events[0]!.event.payload).toEqual({
      id: task.id,
      projectId: source.id,
    });
    expect(events[0]!.event.transferred).toBe(true);
    expect(events[1]!.event.payload.projectId).toBe(target.id);
    testDb.close();
  });

  it("rejects a target project of another organization as not found", async () => {
    const { user, orgSvc, projSvc, source, taskSvc, testDb } = await setup();
    const otherOrg = orgSvc.createOrg(user.id, { name: "Other" });
    const foreign = projSvc.createProject(otherOrg.id, { name: "Foreign" });
    const task = taskSvc.createTask(source.id, user.id, baseTask);

    expect(() =>
      taskSvc.transferTask(task.id, user.id, { targetProjectId: foreign.id }),
    ).toThrow(/Project not found/);
    expect(() =>
      taskSvc.transferTask(task.id, user.id, { targetProjectId: "nope" }),
    ).toThrow(/Project not found/);

    expect(taskSvc.getTask(task.id)?.projectId).toBe(source.id);
    expect(taskSvc.getTaskHistory(task.id).length).toBe(0);
    testDb.close();
  });

  it("rejects a transfer to the task's own project", async () => {
    const { user, source, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(source.id, user.id, baseTask);

    expect(() =>
      taskSvc.transferTask(task.id, user.id, { targetProjectId: source.id }),
    ).toThrow(/already in this project/);
    expect(taskSvc.getTaskHistory(task.id).length).toBe(0);
    testDb.close();
  });

  it("rejects an actor who is not a member of the task's organization", async () => {
    const { idSvc, user, source, target, taskSvc, testDb } = await setup();
    const outsider = await idSvc.register({
      email: "bob@example.com",
      password: "password123",
      displayName: "Bob",
    });
    const task = taskSvc.createTask(source.id, user.id, baseTask);

    expect(() =>
      taskSvc.transferTask(
        task.id,
        outsider.id,
        { targetProjectId: target.id },
        true,
      ),
    ).toThrow(/not found/i);
    expect(taskSvc.getTask(task.id)?.projectId).toBe(source.id);
    testDb.close();
  });
});
