import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createVerifiedUser } from "../../db/test-utils.js";
import { OrganizationService } from "../../features/organization/organization.service.js";
import { ProjectService } from "../../features/project/project.service.js";
import { WikiService } from "../../features/wiki/wiki.service.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

async function setup() {
  const testDb = createTestDb();
  const events: Array<{ room: string; event: unknown }> = [];
  const orgSvc = new OrganizationService(testDb.db);
  const projectSvc = new ProjectService(testDb.db);
  const wikiSvc = new WikiService(testDb.db, (room, event) => {
    events.push({ room, event });
  });
  const user = await createVerifiedUser(testDb.db, {
    email: "alice@example.com",
    password: "password123",
    displayName: "Alice",
  });
  const org = orgSvc.createOrg(user.id, { name: "Acme" });
  const project = projectSvc.createProject(org.id, { name: "Sprint" });
  return { testDb, projectSvc, wikiSvc, events, user, org, project };
}

describe("WikiService page operations", () => {
  it("creates pages with parsed properties, history, and broadcasts", async () => {
    const { testDb, wikiSvc, events, user, org, project } = await setup();

    const page = await wikiSvc.createPage(org.id, user.id, {
      title: "Sprint Notes",
      content: "# Notes",
      projectId: project.id,
      properties: { status: "draft" },
    });

    expect(page.slug).toBe("sprint-notes");
    expect(page.properties).toEqual({ status: "draft" });
    expect((await wikiSvc.getHistory(page.id)).items).toHaveLength(1);
    expect(events[0]).toMatchObject({
      room: `org:${org.id}`,
      event: { type: "wiki.page_created", page: { id: page.id } },
    });
    testDb.close();
  });

  it("paginates history and records the edit source", async () => {
    const { testDb, wikiSvc, user, org } = await setup();
    const page = await wikiSvc.createPage(org.id, user.id, {
      title: "Draft",
      content: "v0",
    });
    for (let i = 1; i <= 4; i++) {
      await wikiSvc.updatePage(page.id, user.id, { content: `v${i}` }, "mcp");
    }

    const firstPage = await wikiSvc.getHistory(page.id, { limit: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.items.every((v) => v.source === "mcp")).toBe(true);

    const lastPage = await wikiSvc.getHistory(page.id, { limit: 2, offset: 4 });
    expect(lastPage.items).toHaveLength(1);
    expect(lastPage.hasMore).toBe(false);
    expect(lastPage.items[0]!.source).toBe("web");

    testDb.close();
  });

  it("updates pages, writes history only for title/content, and broadcasts", async () => {
    const { testDb, wikiSvc, events, user, org } = await setup();
    const page = await wikiSvc.createPage(org.id, user.id, {
      title: "Draft",
      content: "Old",
    });

    const updated = await wikiSvc.updatePage(page.id, user.id, {
      title: "Launch Plan",
      content: "New",
      properties: { state: "ready" },
    });

    expect(updated.slug).toBe("launch-plan");
    expect(updated.properties).toEqual({ state: "ready" });
    expect((await wikiSvc.getHistory(page.id)).items).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({
      room: `org:${org.id}`,
      event: { type: "wiki.page_updated", page: { id: page.id } },
    });
    testDb.close();
  });

  it("skips history, updatedAt and broadcast when nothing changed", async () => {
    const { testDb, wikiSvc, events, user, org } = await setup();
    const page = await wikiSvc.createPage(org.id, user.id, {
      title: "Draft",
      content: "Same",
      properties: { state: "ready" },
    });
    const eventCount = events.length;

    const unchanged = await wikiSvc.updatePage(page.id, user.id, {
      title: "Draft",
      content: "Same",
      properties: { state: "ready" },
    });

    expect(unchanged.updatedAt).toBe(page.updatedAt);
    expect((await wikiSvc.getHistory(page.id)).items).toHaveLength(1);
    expect(events).toHaveLength(eventCount);
    testDb.close();
  });

  it("creates an organization root page with project wiki links", async () => {
    const { testDb, wikiSvc, user, org, project } = await setup();

    const root = await wikiSvc.ensureRootPage(org.id, user.id);
    const pages = await wikiSvc.listPages(org.id, user.id);

    expect(root.slug).toBe("root");
    expect(root.content).toContain("<!-- kanban:auto-project-index:start -->");
    expect(root.content).toContain(`/orgs/${org.id}/projects/${project.id}`);
    expect(pages.map((page) => page.slug).sort()).toEqual([
      "kb-sprint",
      "root",
    ]);
    expect(
      pages.find(
        (page) =>
          page.title === "KB: Sprint" &&
          page.projectId === project.id &&
          page.parentId === root.id,
      ),
    ).toBeTruthy();
    testDb.close();
  });

  it("nests knowledge bases of later projects under the organization index", async () => {
    const { testDb, projectSvc, wikiSvc, user, org } = await setup();
    const root = await wikiSvc.ensureRootPage(org.id, user.id);

    const project = projectSvc.createProject(
      org.id,
      { name: "Roadmap" },
      user.id,
    );
    const pages = await wikiSvc.listPages(org.id, user.id);
    const kbPage = pages.find((page) => page.projectId === project.id);

    expect(kbPage?.title).toBe("KB: Roadmap");
    expect(kbPage?.parentId).toBe(root.id);
    testDb.close();
  });

  it("refuses to delete the organization index page", async () => {
    const { testDb, wikiSvc, user, org } = await setup();
    const root = await wikiSvc.ensureRootPage(org.id, user.id);

    await expect(wikiSvc.deletePage(root.id, user.id)).rejects.toThrow(
      "The organization index page cannot be deleted",
    );
    expect(await wikiSvc.getPage(root.id)).toBeTruthy();
    testDb.close();
  });

  it("refuses to delete project knowledge base pages", async () => {
    const { testDb, wikiSvc, user, org, project } = await setup();
    await wikiSvc.ensureRootPage(org.id, user.id);
    const kbPage = (await wikiSvc.listPages(org.id, user.id)).find(
      (page) => page.projectId === project.id,
    );

    await expect(wikiSvc.deletePage(kbPage!.id, user.id)).rejects.toThrow(
      "Project knowledge base pages cannot be deleted",
    );
    expect(await wikiSvc.getPage(kbPage!.id)).toBeTruthy();
    testDb.close();
  });

  it("deletes a page together with its descendants", async () => {
    const { testDb, wikiSvc, user, org } = await setup();
    const parent = await wikiSvc.createPage(org.id, user.id, {
      title: "Parent",
      content: "p",
    });
    const child = await wikiSvc.createPage(org.id, user.id, {
      title: "Child",
      content: "c",
      parentId: parent.id,
    });

    await wikiSvc.deletePage(parent.id, user.id);

    expect(await wikiSvc.getPage(parent.id)).toBeUndefined();
    expect(await wikiSvc.getPage(child.id)).toBeUndefined();
    testDb.close();
  });

  it("refuses to rename the organization index and project knowledge bases", async () => {
    const { testDb, wikiSvc, user, org, project } = await setup();
    const root = await wikiSvc.ensureRootPage(org.id, user.id);
    const kbPage = (await wikiSvc.listPages(org.id, user.id)).find(
      (page) => page.projectId === project.id,
    );

    await expect(
      wikiSvc.updatePage(root.id, user.id, { title: "My Index" }),
    ).rejects.toThrow("The organization index page cannot be renamed");
    await expect(
      wikiSvc.updatePage(kbPage!.id, user.id, { title: "Sprint Docs" }),
    ).rejects.toThrow("Project knowledge base pages cannot be renamed");

    // Content edits on those pages stay allowed.
    const edited = await wikiSvc.updatePage(kbPage!.id, user.id, {
      content: "Updated body",
    });
    expect(edited.title).toBe("KB: Sprint");
    expect(edited.content).toBe("Updated body");
    testDb.close();
  });

  it("refuses to move the organization index and project knowledge bases", async () => {
    const { testDb, wikiSvc, user, org, project } = await setup();
    const root = await wikiSvc.ensureRootPage(org.id, user.id);
    const kbPage = (await wikiSvc.listPages(org.id, user.id)).find(
      (page) => page.projectId === project.id,
    );
    const host = await wikiSvc.createPage(org.id, user.id, {
      title: "Host",
      content: "h",
    });

    await expect(
      wikiSvc.updatePage(root.id, user.id, { parentId: host.id }),
    ).rejects.toThrow("The organization index page cannot be moved");
    await expect(
      wikiSvc.updatePage(kbPage!.id, user.id, { parentId: host.id }),
    ).rejects.toThrow("Project knowledge base pages cannot be moved");

    expect((await wikiSvc.getPage(root.id))?.parentId).toBeNull();
    expect((await wikiSvc.getPage(kbPage!.id))?.parentId).toBe(root.id);
    testDb.close();
  });

  it("moves a regular page under a new parent", async () => {
    const { testDb, wikiSvc, user, org } = await setup();
    const parent = await wikiSvc.createPage(org.id, user.id, {
      title: "Parent",
      content: "p",
    });
    const page = await wikiSvc.createPage(org.id, user.id, {
      title: "Loose",
      content: "l",
    });

    const moved = await wikiSvc.updatePage(page.id, user.id, {
      parentId: parent.id,
    });

    expect(moved.parentId).toBe(parent.id);
    testDb.close();
  });

  it("renames a regular page and regenerates its slug", async () => {
    const { testDb, wikiSvc, user, org, project } = await setup();
    const root = await wikiSvc.ensureRootPage(org.id, user.id);
    const kbPage = (await wikiSvc.listPages(org.id, user.id)).find(
      (page) => page.projectId === project.id,
    );

    // A project-scoped page that is not the knowledge base root stays renamable.
    const child = await wikiSvc.createPage(org.id, user.id, {
      title: "Draft Notes",
      content: "body",
      projectId: project.id,
      parentId: kbPage!.id,
    });
    const renamedChild = await wikiSvc.updatePage(child.id, user.id, {
      title: "Architecture",
    });
    expect(renamedChild.title).toBe("Architecture");
    expect(renamedChild.slug).toBe("architecture");

    const orgPage = await wikiSvc.createPage(org.id, user.id, {
      title: "Meeting",
      content: "body",
      parentId: root.id,
    });
    const renamedOrgPage = await wikiSvc.updatePage(orgPage.id, user.id, {
      title: "Weekly Meeting",
    });
    expect(renamedOrgPage.slug).toBe("weekly-meeting");
    expect((await wikiSvc.getHistory(orgPage.id)).items).toHaveLength(2);
    testDb.close();
  });

  it("recreates the organization index automated part when a project is created", async () => {
    const { testDb, projectSvc, wikiSvc, user, org } = await setup();
    const root = await wikiSvc.ensureRootPage(org.id, user.id);

    await wikiSvc.updatePage(root.id, user.id, {
      content: "# Custom Organization Notes\n\nManual notes stay here.",
    });
    const project = projectSvc.createProject(
      org.id,
      { name: "Roadmap" },
      user.id,
    );
    const updatedRoot = await wikiSvc.getPage(root.id);

    expect(updatedRoot?.content).toContain("Manual notes stay here.");
    expect(updatedRoot?.content).toContain(
      "<!-- kanban:auto-project-index:start -->",
    );
    expect(updatedRoot?.content).toContain(
      `/orgs/${org.id}/projects/${project.id}`,
    );
    testDb.close();
  });

  it("marks deleted project knowledge bases and removes board links from the organization index", async () => {
    const { testDb, projectSvc, wikiSvc, user, org, project } = await setup();
    const projectPage = (await wikiSvc.listPages(org.id, user.id)).find(
      (page) => page.projectId === project.id,
    );

    expect(projectPage).toBeTruthy();
    projectSvc.deleteProject(org.id, project.id, user.id);

    const root = await wikiSvc.ensureRootPage(org.id, user.id);
    const deletedPage = await wikiSvc.getPage(projectPage!.id);

    expect(root.content).not.toContain(
      `[Board](/orgs/${org.id}/projects/${project.id})`,
    );
    expect(root.content).toMatch(
      /\*\*Sprint\*\*: deleted on \d{4}-\d{2}-\d{2}/,
    );
    expect(root.content).toContain(
      `[Knowledge Base](wiki://${projectPage!.id})`,
    );
    expect(deletedPage).toBeTruthy();
    expect(deletedPage?.projectId).toBeNull();
    expect(deletedPage?.content.startsWith("[DELETED PROJECT]\n\n")).toBe(true);
    testDb.close();
  });

  it("deletes pages and broadcasts the deleted id", async () => {
    const { testDb, wikiSvc, events, user, org } = await setup();
    const page = await wikiSvc.createPage(org.id, user.id, {
      title: "Temp",
      content: "Remove me",
    });

    await wikiSvc.deletePage(page.id, user.id);

    expect(await wikiSvc.getPage(page.id)).toBeUndefined();
    expect(events.at(-1)).toEqual({
      room: `org:${org.id}`,
      event: { type: "wiki.page_deleted", pageId: page.id },
    });
    testDb.close();
  });
});
