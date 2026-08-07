import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, loginTestUser } from "../../db/test-utils.js";
import { createApp } from "../../app.js";
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
  return { handlers, orgId: org.id, project, close: testDb.close };
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
