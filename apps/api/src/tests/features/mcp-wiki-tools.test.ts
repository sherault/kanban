import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createVerifiedUser } from "../../db/test-utils.js";
import { OrganizationService } from "../../features/organization/organization.service.js";
import { registerWikiTools } from "../../features/mcp/mcp-server/wiki-tools.js";
import { WikiService } from "../../features/wiki/wiki.service.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

function parseToolResult(result: any) {
  return JSON.parse(result.content[0].text);
}

async function setup() {
  const testDb = createTestDb();
  const orgSvc = new OrganizationService(testDb.db);
  const wikiSvc = new WikiService(testDb.db);
  const user = await createVerifiedUser(testDb.db, {
    email: "alice@example.com",
    password: "password123",
    displayName: "Alice",
  });
  const org = orgSvc.createOrg(user.id, { name: "Acme" });

  const tools = new Map<string, (input: any) => Promise<any>>();
  const server = {
    registerTool(name: string, _config: unknown, handler: any) {
      tools.set(name, handler);
    },
  };
  registerWikiTools(server as any, wikiSvc, user.id);

  const call = async (name: string, input: any) =>
    parseToolResult(await tools.get(name)!(input));

  return { testDb, wikiSvc, user, org, call };
}

describe("update_wiki_page patch semantics", () => {
  it("leaves properties untouched when only the title is updated", async () => {
    const { testDb, org, user, wikiSvc, call } = await setup();
    const page = await wikiSvc.createPage(org.id, user.id, {
      title: "Runbook",
      content: "# Steps",
      properties: { doc_type: "runbook", validation_status: "verified" },
    });

    const updated = await call("update_wiki_page", {
      pageId: page.id,
      title: "Incident Runbook",
    });

    expect(updated.title).toBe("Incident Runbook");
    expect(updated.content).toBe("# Steps");
    expect(updated.properties).toEqual({
      doc_type: "runbook",
      validation_status: "verified",
    });
    testDb.close();
  });

  it("leaves title and properties untouched when only content is updated", async () => {
    const { testDb, org, user, wikiSvc, call } = await setup();
    const parent = await wikiSvc.createPage(org.id, user.id, {
      title: "Parent",
      content: "",
    });
    const page = await wikiSvc.createPage(org.id, user.id, {
      title: "Runbook",
      content: "# Steps",
      parentId: parent.id,
      properties: { doc_type: "runbook" },
    });

    const updated = await call("update_wiki_page", {
      pageId: page.id,
      content: "# Steps\n\n1. Page the on-call",
    });

    expect(updated.content).toBe("# Steps\n\n1. Page the on-call");
    expect(updated.title).toBe("Runbook");
    expect(updated.slug).toBe(page.slug);
    expect(updated.parentId).toBe(parent.id);
    expect(updated.properties).toEqual({ doc_type: "runbook" });
    testDb.close();
  });

  it("leaves title and content untouched when only properties are updated", async () => {
    const { testDb, org, user, wikiSvc, call } = await setup();
    const page = await wikiSvc.createPage(org.id, user.id, {
      title: "Runbook",
      content: "# Steps",
      properties: { doc_type: "runbook" },
    });

    const updated = await call("update_wiki_page", {
      pageId: page.id,
      properties: { doc_type: "policy" },
    });

    expect(updated.properties).toEqual({ doc_type: "policy" });
    expect(updated.title).toBe("Runbook");
    expect(updated.content).toBe("# Steps");
    testDb.close();
  });

  it("clears properties only when null is passed explicitly", async () => {
    const { testDb, org, user, wikiSvc, call } = await setup();
    const page = await wikiSvc.createPage(org.id, user.id, {
      title: "Runbook",
      content: "# Steps",
      properties: { doc_type: "runbook" },
    });

    const updated = await call("update_wiki_page", {
      pageId: page.id,
      properties: null,
    });

    expect(updated.properties).toBeNull();
    expect(updated.content).toBe("# Steps");
    testDb.close();
  });

  it("detaches the parent only when null is passed explicitly", async () => {
    const { testDb, org, user, wikiSvc, call } = await setup();
    const parent = await wikiSvc.createPage(org.id, user.id, {
      title: "Parent",
      content: "",
    });
    const page = await wikiSvc.createPage(org.id, user.id, {
      title: "Child",
      content: "body",
      parentId: parent.id,
      properties: { doc_type: "runbook" },
    });

    const kept = await call("update_wiki_page", {
      pageId: page.id,
      content: "body v2",
    });
    expect(kept.parentId).toBe(parent.id);

    const detached = await call("update_wiki_page", {
      pageId: page.id,
      parentId: null,
    });
    expect(detached.parentId).toBeNull();
    expect(detached.properties).toEqual({ doc_type: "runbook" });
    testDb.close();
  });

  it("set_wiki_page_property merges one key and preserves title and content", async () => {
    const { testDb, org, user, wikiSvc, call } = await setup();
    const page = await wikiSvc.createPage(org.id, user.id, {
      title: "Runbook",
      content: "# Steps",
      properties: { doc_type: "runbook", freshness: "2026-01-01" },
    });

    const updated = await call("set_wiki_page_property", {
      pageId: page.id,
      key: "validation_status",
      value: "verified",
    });

    expect(updated.properties).toEqual({
      doc_type: "runbook",
      freshness: "2026-01-01",
      validation_status: "verified",
    });
    expect(updated.title).toBe("Runbook");
    expect(updated.content).toBe("# Steps");

    const deleted = await call("set_wiki_page_property", {
      pageId: page.id,
      key: "freshness",
      value: null,
    });
    expect(deleted.properties).toEqual({
      doc_type: "runbook",
      validation_status: "verified",
    });
    testDb.close();
  });
});
