import { describe, expect, it } from "vitest";
import type { TaskDto } from "@kanban/shared";
import { archivedTaskMatches } from "../../features/task/task-service/archive-list.js";
import { assertProjectTask } from "../../features/task/task-routes/guards.js";
import type { TaskService } from "../../features/task/task.service.js";

function task(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: "task-1",
    projectId: "project-1",
    projectName: "Sprint",
    column: "todo",
    title: "Fix login",
    description: null,
    objective: null,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    backgroundColor: null,
    globalSubject: null,
    position: 1,
    reporter: { id: "user-1", displayName: "Alice" },
    doer: null,
    validator: null,
    watchers: [],
    advisors: [],
    tags: [],
    linkedTaskIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

describe("archivedTaskMatches", () => {
  it("matches archived tasks by tags and participant names", () => {
    const dto = task({
      tags: ["urgent"],
      watchers: [{ id: "user-2", displayName: "Bianca Reviewer" }],
    });

    expect(archivedTaskMatches(dto, "urgent")).toBe(true);
    expect(archivedTaskMatches(dto, "bianca")).toBe(true);
    expect(archivedTaskMatches(dto, "unrelated")).toBe(false);
  });
});

describe("assertProjectTask", () => {
  it("returns a task only when it belongs to the requested project", () => {
    const dto = task();
    const svc = {
      getTask: (taskId: string) => (taskId === dto.id ? dto : undefined),
    } as TaskService;

    expect(assertProjectTask(svc, "project-1", "task-1")).toBe(dto);
    expect(() => assertProjectTask(svc, "project-2", "task-1")).toThrow(
      "Task not found",
    );
    expect(() => assertProjectTask(svc, "project-1", "missing")).toThrow(
      "Task not found",
    );
  });
});
