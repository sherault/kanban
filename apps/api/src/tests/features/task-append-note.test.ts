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

const STAMP = /^#### \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/;

describe("TaskService.appendTaskNote", () => {
  it("sets the description when it was empty", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);

    const updated = taskSvc.appendTaskNote(task.id, user.id, "First note");

    const lines = updated.description!.split("\n");
    expect(lines[0]).toMatch(STAMP);
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("First note");
    testDb.close();
  });

  it("appends after the existing description separated by a blank line", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, {
      ...baseTask,
      description: "Original body",
    });

    const updated = taskSvc.appendTaskNote(task.id, user.id, "Progress");

    expect(updated.description).toMatch(
      /^Original body\n\n#### .* UTC\n\nProgress$/,
    );
    testDb.close();
  });

  it("trims trailing whitespace off the existing description", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, {
      ...baseTask,
      description: "Original body\n\n\n",
    });

    const updated = taskSvc.appendTaskNote(task.id, user.id, "Progress");

    expect(updated.description).toMatch(
      /^Original body\n\n#### .* UTC\n\nProgress$/,
    );
    testDb.close();
  });

  it("stamps the assigned doer's display name", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, {
      ...baseTask,
      doerId: user.id,
    });

    const updated = taskSvc.appendTaskNote(task.id, user.id, "Progress");

    expect(updated.description!.split("\n")[0]).toMatch(
      /^#### \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC — Alice$/,
    );
    testDb.close();
  });

  it("omits the name part when no doer is assigned", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);

    const updated = taskSvc.appendTaskNote(task.id, user.id, "Progress");

    expect(updated.description!.split("\n")[0]).toMatch(
      /^#### \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/,
    );
    testDb.close();
  });

  it("trims the note text", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);

    const updated = taskSvc.appendTaskNote(task.id, user.id, "  Progress  \n");

    expect(updated.description!.endsWith("Progress")).toBe(true);
    testDb.close();
  });

  it("rejects an empty note", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);

    expect(() => taskSvc.appendTaskNote(task.id, user.id, "   ")).toThrow();
    testDb.close();
  });

  it("throws for an unknown task", async () => {
    const { user, taskSvc, testDb } = await setup();
    expect(() => taskSvc.appendTaskNote("nope", user.id, "Progress")).toThrow();
    testDb.close();
  });

  it("keeps both blocks when appending twice", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);

    taskSvc.appendTaskNote(task.id, user.id, "First");
    const updated = taskSvc.appendTaskNote(task.id, user.id, "Second");

    expect(updated.description).toContain("First");
    expect(updated.description).toContain("Second");
    expect(updated.description!.match(/^#### /gm)?.length).toBe(2);
    testDb.close();
  });

  it("records a note history entry holding only the appended text", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, {
      ...baseTask,
      description: "Original body",
    });

    taskSvc.appendTaskNote(task.id, user.id, "Progress");

    const history = taskSvc.getTaskHistory(task.id);
    expect(
      history.filter((entry) => entry.field === "description").length,
    ).toBe(0);
    const notes = history.filter((entry) => entry.field === "note");
    expect(notes.length).toBe(1);
    expect(notes[0]!.oldValue).toBe(null);
    expect(notes[0]!.newValue).toBe("Progress");
    expect(notes[0]!.actor.id).toBe(user.id);
    testDb.close();
  });

  it("keeps one note entry per append instead of growing copies", async () => {
    const { user, project, taskSvc, testDb } = await setup();
    const task = taskSvc.createTask(project.id, user.id, baseTask);

    taskSvc.appendTaskNote(task.id, user.id, "First");
    taskSvc.appendTaskNote(task.id, user.id, "Second");

    const notes = taskSvc
      .getTaskHistory(task.id)
      .filter((entry) => entry.field === "note")
      .map((entry) => entry.newValue)
      .sort();
    expect(notes).toEqual(["First", "Second"]);
    testDb.close();
  });
});
