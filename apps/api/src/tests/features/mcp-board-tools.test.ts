import { describe, expect, it } from "vitest";
import { registerBoardTools } from "../../features/mcp/mcp-server/board-tools.js";

function makeHarness(tasks: any[] = []) {
  const tools = new Map<string, (input: any) => any>();

  const server = {
    registerTool(name: string, _config: unknown, handler: any) {
      tools.set(name, handler);
    },
  };

  const taskSvc = {
    listTasks(projectId: string) {
      return tasks.filter((task) => task.projectId === projectId);
    },
  };

  registerBoardTools(server as any, taskSvc as any);

  return { tools };
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    projectId: "project-1",
    column: "todo",
    title: "Ship get_board",
    endDate: "2026-07-28",
    backgroundColor: null,
    position: 0,
    tags: [],
    doer: null,
    ...overrides,
  };
}

function callBoard(tasks: any[], args: Record<string, unknown> = {}): string {
  const { tools } = makeHarness(tasks);
  const handler = tools.get("get_board")!;
  return handler({ projectId: "project-1", limitPerColumn: 50, ...args })
    .content[0].text;
}

describe("get_board", () => {
  it("renders all four columns with their totals, even when empty", () => {
    const text = callBoard([
      makeTask({ id: "t1", column: "todo" }),
      makeTask({ id: "t2", column: "todo" }),
      makeTask({ id: "t3", column: "doing" }),
    ]);

    expect(text).toContain("Board: project project-1");
    expect(text).toContain("## IDEAS (0)");
    expect(text).toContain("## TODO (2)");
    expect(text).toContain("## DOING (1)");
    expect(text).toContain("## DONE (0)");
  });

  it("groups each task under its own column", () => {
    const text = callBoard([
      makeTask({ id: "t1", column: "todo", title: "Todo task" }),
      makeTask({ id: "t2", column: "done", title: "Done task" }),
    ]);

    const todoIndex = text.indexOf("## TODO");
    const doneIndex = text.indexOf("## DONE");
    expect(text.indexOf("[t1] Todo task")).toBeGreaterThan(todoIndex);
    expect(text.indexOf("[t1] Todo task")).toBeLessThan(doneIndex);
    expect(text.indexOf("[t2] Done task")).toBeGreaterThan(doneIndex);
  });

  it("orders tasks inside a column by position ascending", () => {
    const text = callBoard([
      makeTask({ id: "t-c", position: 2 }),
      makeTask({ id: "t-a", position: 0 }),
      makeTask({ id: "t-b", position: 1 }),
    ]);

    expect(text.indexOf("[t-a]")).toBeLessThan(text.indexOf("[t-b]"));
    expect(text.indexOf("[t-b]")).toBeLessThan(text.indexOf("[t-c]"));
  });

  it("breaks a position tie by id so the render is deterministic", () => {
    const text = callBoard([
      makeTask({ id: "t-b", position: 0 }),
      makeTask({ id: "t-a", position: 0 }),
    ]);

    expect(text.indexOf("[t-a]")).toBeLessThan(text.indexOf("[t-b]"));
  });

  it("renders doer, due date, tags and colour in the documented order", () => {
    const text = callBoard([
      makeTask({
        id: "t1",
        title: "Fix auth bug",
        doer: { id: "u1", displayName: "alice" },
        endDate: "2026-08-01",
        tags: ["bug", "api"],
        backgroundColor: "#ff0000",
      }),
    ]);

    expect(text).toContain(
      "- [t1] Fix auth bug [@alice] due:2026-08-01 #bug #api ^#ff0000",
    );
  });

  it("omits doer, tags and colour when they are absent", () => {
    const text = callBoard([
      makeTask({ id: "t1", title: "Write docs", endDate: "2026-08-15" }),
    ]);

    expect(text).toContain("- [t1] Write docs due:2026-08-15");
  });

  it("keeps only the date part of endDate", () => {
    const text = callBoard([
      makeTask({ id: "t1", endDate: "2026-08-15 09:30:00" }),
    ]);

    expect(text).toContain("due:2026-08-15");
    expect(text).not.toContain("09:30:00");
  });

  it("truncates a column at limitPerColumn but keeps the full count in the header", () => {
    const tasks = Array.from({ length: 5 }, (_, index) =>
      makeTask({ id: `t${index}`, position: index }),
    );

    const text = callBoard(tasks, { limitPerColumn: 2 });

    expect(text).toContain("## TODO (5)");
    expect(text).toContain("[t0]");
    expect(text).toContain("[t1]");
    expect(text).not.toContain("[t2]");
    expect(text).toContain("- … 3 more (use list_tasks)");
  });

  it("renders an empty board for a project with no tasks", () => {
    const text = callBoard([]);

    expect(text).toContain("## IDEAS (0)");
    expect(text).toContain("## TODO (0)");
    expect(text).toContain("## DOING (0)");
    expect(text).toContain("## DONE (0)");
    expect(text).not.toContain("more (use list_tasks)");
  });
});
