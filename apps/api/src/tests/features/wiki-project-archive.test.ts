import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, loginTestUser } from "../../db/test-utils.js";
import { createApp } from "../../app.js";
import { ProjectService } from "../../features/project/project.service.js";
import { wikiPages } from "../../db/schema/wiki.js";
import { and, eq } from "drizzle-orm";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

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
  return {
    db: testDb.db,
    svc,
    orgId: org.id,
    project,
    userId,
    close: testDb.close,
  };
}

function rootContent(db: ReturnType<typeof createTestDb>["db"], orgId: string) {
  const page = db
    .select()
    .from(wikiPages)
    .where(and(eq(wikiPages.organizationId, orgId), eq(wikiPages.slug, "root")))
    .get();
  return page?.content ?? "";
}

function kbContent(
  db: ReturnType<typeof createTestDb>["db"],
  orgId: string,
  projectId: string,
) {
  const page = db
    .select()
    .from(wikiPages)
    .where(
      and(
        eq(wikiPages.organizationId, orgId),
        eq(wikiPages.projectId, projectId),
      ),
    )
    .get();
  return page?.content ?? "";
}

describe("organization index on project archive", () => {
  it("moves the project from Active to Archived", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    expect(rootContent(db, orgId)).toContain("### Active");
    svc.archiveProject(orgId, project.id, userId);
    const content = rootContent(db, orgId);
    expect(content).toContain("### Archived");
    const archivedSection = content.slice(content.indexOf("### Archived"));
    expect(archivedSection).toContain("**Sprint**");
    expect(archivedSection).toMatch(/archived on \d{4}-\d{2}-\d{2}/);
    expect(archivedSection).toContain(
      `[Board](/orgs/${orgId}/projects/${project.id})`,
    );
    expect(archivedSection).toContain("[Knowledge Base]");
    const activeSection = content.slice(
      content.indexOf("### Active"),
      content.indexOf("### Archived"),
    );
    expect(activeSection).toContain("No active projects.");
    close();
  });

  it("moves the project back to Active on restore and drops the section", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    svc.archiveProject(orgId, project.id, userId);
    svc.restoreProject(orgId, project.id, userId);
    const content = rootContent(db, orgId);
    expect(content).not.toContain("### Archived");
    expect(content).toContain("**Sprint**");
    close();
  });
});

describe("knowledge base archive notice", () => {
  it("prepends a details block with the archive date", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    svc.archiveProject(orgId, project.id, userId);
    const content = kbContent(db, orgId, project.id);
    expect(content.startsWith("<!-- kanban:project-archived:start -->")).toBe(
      true,
    );
    expect(content).toContain("<details>");
    expect(content).toContain("Archived project");
    expect(content).toMatch(/archived on \d{4}-\d{2}-\d{2}/);
    expect(content).toContain("<!-- kanban:project-archived:end -->");
    expect(content).toContain("Documentation for project Sprint starts here.");
    close();
  });

  it("does not stack the block when archive runs twice", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    svc.archiveProject(orgId, project.id, userId);
    svc.restoreProject(orgId, project.id, userId);
    svc.archiveProject(orgId, project.id, userId);
    const content = kbContent(db, orgId, project.id);
    expect(
      content.split("<!-- kanban:project-archived:start -->"),
    ).toHaveLength(2);
    close();
  });

  it("removes the block on restore", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    svc.archiveProject(orgId, project.id, userId);
    svc.restoreProject(orgId, project.id, userId);
    const content = kbContent(db, orgId, project.id);
    expect(content).not.toContain("kanban:project-archived");
    expect(content.startsWith("# KB: Sprint")).toBe(true);
    close();
  });

  it("keeps user content when restoring a page that never had the block", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    const before = kbContent(db, orgId, project.id);
    svc.archiveProject(orgId, project.id, userId);
    svc.restoreProject(orgId, project.id, userId);
    expect(kbContent(db, orgId, project.id)).toBe(before);
    close();
  });

  it("preserves the KB page's own leading/trailing whitespace across an archive/restore round trip", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    const page = db
      .select()
      .from(wikiPages)
      .where(
        and(
          eq(wikiPages.organizationId, orgId),
          eq(wikiPages.projectId, project.id),
        ),
      )
      .get();
    if (!page) throw new Error("KB page not found");
    const withOwnWhitespace = "\n\n# KB: Sprint\n\nBody\n\n";
    db.update(wikiPages)
      .set({ content: withOwnWhitespace })
      .where(eq(wikiPages.id, page.id))
      .run();

    svc.archiveProject(orgId, project.id, userId);
    svc.restoreProject(orgId, project.id, userId);

    expect(kbContent(db, orgId, project.id)).toBe(withOwnWhitespace);
    close();
  });
});

describe("deleting an archived project", () => {
  it("still records a Deleted entry", async () => {
    const { db, svc, orgId, project, userId, close } = await setup();
    svc.archiveProject(orgId, project.id, userId);
    svc.deleteProject(orgId, project.id, userId);
    const content = rootContent(db, orgId);
    expect(content).toContain("### Deleted");
    expect(content).toMatch(/\*\*Sprint\*\*: deleted on \d{4}-\d{2}-\d{2}/);
    expect(content).not.toContain("### Archived");
    close();
  });
});
