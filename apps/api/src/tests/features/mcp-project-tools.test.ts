import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, loginTestUser } from "../../db/test-utils.js";
import { createApp } from "../../app.js";
import { memberships } from "../../db/schema/index.js";
import { ProjectService } from "../../features/project/project.service.js";
import { registerProjectTools } from "../../features/mcp/mcp-server/project-tools.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

type Handler = (input: Record<string, unknown>) => {
  content: Array<{ text: string }>;
};

function collectTools() {
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _config: unknown, handler: Handler) => {
      handlers.set(name, handler);
    },
  };
  return { server, handlers };
}

function parse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0]?.text ?? "null");
}

async function setup() {
  const testDb = createTestDb();
  const app = createApp(testDb.db);
  const { accessToken, userId } = await loginTestUser(app, testDb.db, {
    email: "alice@example.com",
    password: "password123",
    displayName: "Alice",
  });
  const orgRes = await app.request("/organizations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Alice Org" }),
  });
  const org = (await orgRes.json()) as { id: string };
  const svc = new ProjectService(testDb.db);
  const project = svc.createProject(org.id, { name: "Sprint" }, userId);
  const { server, handlers } = collectTools();
  registerProjectTools(server as never, svc, userId);
  return {
    app,
    db: testDb.db,
    accessToken,
    svc,
    handlers,
    orgId: org.id,
    project,
    close: testDb.close,
  };
}

/** Registers a second set of MCP tool handlers acting as `memberUserId`. */
function toolsFor(svc: ProjectService, memberUserId: string) {
  const { server, handlers } = collectTools();
  registerProjectTools(server as never, svc, memberUserId);
  return handlers;
}

/** Seeds a membership directly, bypassing the co-visibility constraint on
 * POST /organizations/:orgId/members (see organization-member-search.test.ts
 * for the same pattern). */
function addMembership(
  db: ReturnType<typeof createTestDb>["db"],
  orgId: string,
  userId: string,
  role: "member" | "manager" | "owner" = "member",
) {
  db.insert(memberships).values({ organizationId: orgId, userId, role }).run();
}

describe("archive_project / restore_project MCP tools", () => {
  it("archives a project", async () => {
    const { handlers, orgId, project, close } = await setup();
    const result = parse(
      handlers.get("archive_project")!({ orgId, projectId: project.id }),
    );
    expect(result.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    close();
  });

  it("flags archived projects in list_projects", async () => {
    const { handlers, orgId, project, close } = await setup();
    handlers.get("archive_project")!({ orgId, projectId: project.id });
    const list = parse(handlers.get("list_projects")!({ orgId })) as Array<{
      id: string;
      archived?: boolean;
    }>;
    expect(list.find((p) => p.id === project.id)?.archived).toBe(true);
    close();
  });

  it("does not flag active projects", async () => {
    const { handlers, orgId, project, close } = await setup();
    const list = parse(handlers.get("list_projects")!({ orgId })) as Array<{
      id: string;
      archived?: boolean;
    }>;
    expect(list.find((p) => p.id === project.id)?.archived).toBeUndefined();
    close();
  });

  it("restores an archived project", async () => {
    const { handlers, orgId, project, close } = await setup();
    handlers.get("archive_project")!({ orgId, projectId: project.id });
    const result = parse(
      handlers.get("restore_project")!({ orgId, projectId: project.id }),
    );
    expect(result.archivedAt).toBeNull();
    close();
  });

  it("rejects archiving an already archived project", async () => {
    const { handlers, orgId, project, close } = await setup();
    handlers.get("archive_project")!({ orgId, projectId: project.id });
    expect(() =>
      handlers.get("archive_project")!({ orgId, projectId: project.id }),
    ).toThrow(/already archived/);
    close();
  });
});

describe("archive_project / restore_project MCP tools: role gate", () => {
  it("rejects archive_project for a plain member", async () => {
    const { app, db, svc, orgId, project, close } = await setup();
    const { userId: bobId } = await loginTestUser(app, db, {
      email: "bob@example.com",
      password: "password123",
      displayName: "Bob",
    });
    addMembership(db, orgId, bobId, "member");
    const bobHandlers = toolsFor(svc, bobId);

    expect(() =>
      bobHandlers.get("archive_project")!({ orgId, projectId: project.id }),
    ).toThrow();
    close();
  });

  it("rejects restore_project for a plain member", async () => {
    const { app, db, svc, orgId, project, close } = await setup();
    svc.archiveProject(orgId, project.id, undefined);
    const { userId: bobId } = await loginTestUser(app, db, {
      email: "bob@example.com",
      password: "password123",
      displayName: "Bob",
    });
    addMembership(db, orgId, bobId, "member");
    const bobHandlers = toolsFor(svc, bobId);

    expect(() =>
      bobHandlers.get("restore_project")!({ orgId, projectId: project.id }),
    ).toThrow();
    close();
  });

  it("still allows archive_project / restore_project for a manager", async () => {
    const { app, db, svc, orgId, project, close } = await setup();
    const { userId: carolId } = await loginTestUser(app, db, {
      email: "carol@example.com",
      password: "password123",
      displayName: "Carol",
    });
    addMembership(db, orgId, carolId, "manager");
    const carolHandlers = toolsFor(svc, carolId);

    const archived = parse(
      carolHandlers.get("archive_project")!({ orgId, projectId: project.id }),
    );
    expect(archived.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const restored = parse(
      carolHandlers.get("restore_project")!({ orgId, projectId: project.id }),
    );
    expect(restored.archivedAt).toBeNull();
    close();
  });

  it("still allows archive_project for the owner", async () => {
    const { handlers, orgId, project, close } = await setup();
    const archived = parse(
      handlers.get("archive_project")!({ orgId, projectId: project.id }),
    );
    expect(archived.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    close();
  });
});
