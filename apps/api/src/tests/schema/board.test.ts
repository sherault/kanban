import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "../../db/schema/index.js";
import { createTestDb } from "../../db/test-utils.js";
import {
  users,
  organizations,
  memberships,
  projects,
  tasks,
  taskTags,
  taskHistory,
} from "../../db/schema/index.js";

let db: BetterSQLite3Database<typeof schema>;
let closeDb: () => void;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  closeDb = testDb.close;
  db.insert(users)
    .values({ id: "u1", email: "a@b.com", passwordHash: "h", displayName: "A" })
    .run();
  db.insert(organizations).values({ id: "o1", name: "Acme" }).run();
  db.insert(memberships)
    .values({ userId: "u1", organizationId: "o1", role: "owner" })
    .run();
  db.insert(projects)
    .values({ id: "p1", organizationId: "o1", name: "Alpha" })
    .run();
});

afterEach(() => closeDb());

describe("tasks table", () => {
  it('creates a task with default column "todo"', () => {
    db.insert(tasks)
      .values({
        id: "t1",
        projectId: "p1",
        title: "First task",
        startDate: "2026-04-03",
        endDate: "2026-04-05",
        reporterId: "u1",
      })
      .run();

    const result = db.select().from(tasks).all();
    expect(result[0]?.column).toBe("todo");
    expect(result[0]?.doerId).toBeNull();
  });

  it("allows null doerId (not required at creation)", () => {
    db.insert(tasks)
      .values({
        id: "t1",
        projectId: "p1",
        title: "Task without doer",
        startDate: "2026-04-03",
        endDate: "2026-04-05",
        reporterId: "u1",
        doerId: null,
      })
      .run();

    const result = db.select().from(tasks).all();
    expect(result[0]?.doerId).toBeNull();
  });

  it("cascades delete when project is deleted", () => {
    db.insert(tasks)
      .values({
        id: "t1",
        projectId: "p1",
        title: "Task",
        startDate: "2026-04-03",
        endDate: "2026-04-05",
        reporterId: "u1",
      })
      .run();

    db.delete(projects).run();
    expect(db.select().from(tasks).all()).toHaveLength(0);
  });
});

describe("task_tags table", () => {
  it("enforces composite PK (no duplicate tag per task)", () => {
    db.insert(tasks)
      .values({
        id: "t1",
        projectId: "p1",
        title: "Task",
        startDate: "2026-04-03",
        endDate: "2026-04-05",
        reporterId: "u1",
      })
      .run();

    db.insert(taskTags).values({ taskId: "t1", tag: "bug" }).run();
    expect(() =>
      db.insert(taskTags).values({ taskId: "t1", tag: "bug" }).run(),
    ).toThrow();
  });
});

describe("task_history table", () => {
  it("records a history entry with batchId", () => {
    db.insert(tasks)
      .values({
        id: "t1",
        projectId: "p1",
        title: "Task",
        startDate: "2026-04-03",
        endDate: "2026-04-05",
        reporterId: "u1",
      })
      .run();

    db.insert(taskHistory)
      .values({
        id: "h1",
        taskId: "t1",
        userId: "u1",
        field: "column",
        oldValue: "todo",
        newValue: "doing",
        batchId: "batch-xyz",
      })
      .run();

    const result = db.select().from(taskHistory).all();
    expect(result[0]?.batchId).toBe("batch-xyz");
  });
});
