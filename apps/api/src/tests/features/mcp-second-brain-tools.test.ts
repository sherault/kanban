import { describe, expect, it } from "vitest";
import { registerSecondBrainTools } from "../../features/mcp/mcp-server/second-brain-tools.js";

function parseToolResult(result: any) {
  return JSON.parse(result.content[0].text);
}

function makeHarness() {
  const tools = new Map<string, (input: any) => Promise<any>>();
  const pages = new Map<string, any>();
  const tasks: any[] = [];
  let pageCounter = 0;
  let taskCounter = 0;

  const server = {
    registerTool(name: string, _config: unknown, handler: any) {
      tools.set(name, handler);
    },
  };

  const wikiSvc = {
    async createPage(orgId: string, userId: string, input: any) {
      const page = {
        id: `page-${++pageCounter}`,
        organizationId: orgId,
        projectId: input.projectId ?? null,
        parentId: input.parentId ?? null,
        title: input.title,
        slug: input.title.toLowerCase().replace(/\s+/g, "-"),
        content: input.content,
        properties: input.properties ?? null,
        createdBy: userId,
        updatedBy: userId,
        createdAt: "2026-05-12T00:00:00.000Z",
        updatedAt: "2026-05-12T00:00:00.000Z",
      };
      pages.set(page.id, page);
      return page;
    },
    async getPage(pageId: string) {
      return pages.get(pageId);
    },
    async listPages(orgId: string) {
      return [...pages.values()]
        .filter((page) => page.organizationId === orgId)
        .map(({ content: _content, ...summary }) => summary);
    },
    async updatePage(pageId: string, userId: string, input: any) {
      const existing = pages.get(pageId);
      const updated = {
        ...existing,
        ...input,
        properties:
          input.properties !== undefined
            ? input.properties
            : existing.properties,
        updatedBy: userId,
      };
      pages.set(pageId, updated);
      return updated;
    },
  };

  function taskMatches(task: any, query: string) {
    const haystack = [
      task.id,
      task.title,
      task.description,
      task.objective,
      task.globalSubject,
      task.tags?.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  const taskSvc = {
    createTask(projectId: string, reporterId: string, input: any) {
      const task = {
        id: `task-${++taskCounter}`,
        projectId,
        reporterId,
        ...input,
      };
      tasks.push(task);
      return task;
    },
    listTasks(projectId: string, options: any = {}) {
      return tasks.filter(
        (task) =>
          task.projectId === projectId &&
          (!options.search || taskMatches(task, options.search)),
      );
    },
    searchTasksInOrg(_orgId: string, query: string, limit = 20) {
      return tasks
        .filter((task) => taskMatches(task, query))
        .slice(0, limit)
        .map((task) => ({ ...task, projectName: "Default" }));
    },
  };

  registerSecondBrainTools(
    server as any,
    wikiSvc as any,
    taskSvc as any,
    "user-1",
  );

  return { tools, pages, tasks };
}

describe("second-brain MCP tools", () => {
  it("creates inbox captures with metadata and optional triage task", async () => {
    const { tools, tasks } = makeHarness();
    const createCapture = tools.get("create_capture");
    expect(createCapture).toBeDefined();

    const result = parseToolResult(
      await createCapture!({
        orgId: "org-1",
        projectId: "project-1",
        title: "Remember installer decision",
        content: "Docker and external installs are recommended.",
        capturedFrom: "codex",
        createTriageTask: true,
      }),
    );

    expect(result.capturePage.properties).toMatchObject({
      doc_type: "capture",
      status: "inbox",
      captured_from: "codex",
    });
    expect(result.capturePage.properties.related_task_ids).toEqual(["task-1"]);
    expect(result.triageTask.description).toContain("wiki://page-1");
    expect(tasks).toHaveLength(1);
  });

  it("promotes captures to tasks and marks the capture triaged", async () => {
    const { tools } = makeHarness();
    const createCapture = tools.get("create_capture")!;
    const promoteCapture = tools.get("promote_capture_to_task")!;

    const capture = parseToolResult(
      await createCapture({
        orgId: "org-1",
        projectId: "project-1",
        title: "Capture me",
        content: "Needs action.",
      }),
    ).capturePage;

    const result = parseToolResult(
      await promoteCapture({
        capturePageId: capture.id,
        projectId: "project-1",
        title: "Do the thing",
        description: "Acceptance criteria go here.",
        tags: ["p0"],
      }),
    );

    expect(result.task.description).toContain(`wiki://${capture.id}`);
    expect(result.task.tags).toEqual(["capture-promoted", "p0"]);
    expect(result.capturePage.properties).toMatchObject({
      status: "triaged",
      related_task_ids: [result.task.id],
    });
  });

  it("searches wiki content, properties, and task knowledge with durable links", async () => {
    const { tools } = makeHarness();
    const createCapture = tools.get("create_capture")!;
    const promoteCapture = tools.get("promote_capture_to_task")!;
    const searchKnowledge = tools.get("search_knowledge")!;

    const capture = parseToolResult(
      await createCapture({
        orgId: "org-1",
        projectId: "project-1",
        title: "Installer secret handling",
        content:
          "Prefer the OS keychain for MCP API keys. Use agent.env as the fallback.",
        properties: {
          doc_type: "decision",
          status: "active",
          validation_status: "validated",
        },
      }),
    ).capturePage;

    const promoted = parseToolResult(
      await promoteCapture({
        capturePageId: capture.id,
        projectId: "project-1",
        title: "Document keychain fallback",
        description: "Explain when agent.env is used instead of keychain.",
      }),
    );

    const result = parseToolResult(
      await searchKnowledge({
        orgId: "org-1",
        query: "keychain",
        projectId: "project-1",
      }),
    );

    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "wiki_page",
          id: capture.id,
          link: `wiki://${capture.id}`,
          properties: expect.objectContaining({ doc_type: "decision" }),
        }),
        expect.objectContaining({
          type: "task",
          id: promoted.task.id,
          link: `task://${promoted.task.id}`,
        }),
      ]),
    );
  });

  it("audits stale knowledge and can create linked freshness tasks", async () => {
    const { tools, pages, tasks } = makeHarness();
    const createCapture = tools.get("create_capture")!;
    const auditFreshness = tools.get("audit_knowledge_freshness")!;

    const stalePage = parseToolResult(
      await createCapture({
        orgId: "org-1",
        projectId: "project-1",
        title: "Outdated vendor policy",
        content: "This policy must be checked before reuse.",
        properties: {
          doc_type: "decision",
          status: "active",
          validation_status: "draft",
          cite_required: true,
          review_after: "2026-05-01",
        },
      }),
    ).capturePage;

    const result = parseToolResult(
      await auditFreshness({
        orgId: "org-1",
        projectId: "project-1",
        todayDate: "2026-05-12",
        createTasks: true,
      }),
    );

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pageId: stalePage.id,
          link: `wiki://${stalePage.id}`,
          findings: expect.arrayContaining([
            "review_after_due",
            "missing_required_sources",
            "needs_validation",
          ]),
        }),
      ]),
    );
    expect(result.tasksCreated).toEqual([
      expect.objectContaining({ pageId: stalePage.id, taskId: "task-1" }),
    ]);
    expect(tasks[0].description).toContain(`wiki://${stalePage.id}`);
    expect(pages.get(stalePage.id).properties).toMatchObject({
      freshness: {
        status: "review_requested",
        review_task_id: "task-1",
      },
      related_task_ids: ["task-1"],
    });
  });
});
