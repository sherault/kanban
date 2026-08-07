import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, loginTestUser } from "../../db/test-utils.js";
import { createApp } from "../../app.js";
import { memberships } from "../../db/schema/index.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function setup() {
  const testDb = createTestDb();
  const app = createApp(testDb.db);
  const { accessToken } = await loginTestUser(app, testDb.db, {
    email: "alice@example.com",
    password: "password123",
    displayName: "Alice",
  });
  const orgRes = await app.request("/organizations", {
    method: "POST",
    headers: { ...auth(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Alice Org" }),
  });
  const org = (await orgRes.json()) as { id: string };
  const projectRes = await app.request(`/organizations/${org.id}/projects`, {
    method: "POST",
    headers: { ...auth(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Sprint" }),
  });
  const project = (await projectRes.json()) as { id: string };
  return {
    app,
    db: testDb.db,
    accessToken,
    orgId: org.id,
    projectId: project.id,
    close: testDb.close,
  };
}

function archive(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  projectId: string,
) {
  return app.request(`/organizations/${orgId}/projects/${projectId}/archive`, {
    method: "POST",
    headers: auth(token),
  });
}

function restore(
  app: ReturnType<typeof createApp>,
  token: string,
  orgId: string,
  projectId: string,
) {
  return app.request(`/organizations/${orgId}/projects/${projectId}/restore`, {
    method: "POST",
    headers: auth(token),
  });
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

describe("POST /organizations/:orgId/projects/:projectId/archive", () => {
  it("sets archivedAt and returns the updated project", async () => {
    const { app, accessToken, orgId, projectId, close } = await setup();
    const res = await archive(app, accessToken, orgId, projectId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      archivedAt: string | null;
    };
    expect(body.id).toBe(projectId);
    expect(body.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    close();
  });

  it("keeps the project in the list endpoint", async () => {
    const { app, accessToken, orgId, projectId, close } = await setup();
    await archive(app, accessToken, orgId, projectId);
    const res = await app.request(`/organizations/${orgId}/projects`, {
      headers: auth(accessToken),
    });
    const body = (await res.json()) as Array<{
      id: string;
      archivedAt: string | null;
    }>;
    expect(body).toHaveLength(1);
    expect(body[0]?.archivedAt).not.toBeNull();
    close();
  });

  it("rejects archiving twice with 422", async () => {
    const { app, accessToken, orgId, projectId, close } = await setup();
    await archive(app, accessToken, orgId, projectId);
    const res = await archive(app, accessToken, orgId, projectId);
    expect(res.status).toBe(422);
    close();
  });

  it("returns 404 for an unknown project", async () => {
    const { app, accessToken, orgId, close } = await setup();
    const res = await archive(app, accessToken, orgId, "does-not-exist");
    expect(res.status).toBe(404);
    close();
  });
});

describe("POST /organizations/:orgId/projects/:projectId/restore", () => {
  it("clears archivedAt", async () => {
    const { app, accessToken, orgId, projectId, close } = await setup();
    await archive(app, accessToken, orgId, projectId);
    const res = await restore(app, accessToken, orgId, projectId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { archivedAt: string | null };
    expect(body.archivedAt).toBeNull();
    close();
  });

  it("rejects restoring an active project with 422", async () => {
    const { app, accessToken, orgId, projectId, close } = await setup();
    const res = await restore(app, accessToken, orgId, projectId);
    expect(res.status).toBe(422);
    close();
  });

  it("returns 404 for an unknown project", async () => {
    const { app, accessToken, orgId, close } = await setup();
    const res = await restore(app, accessToken, orgId, "does-not-exist");
    expect(res.status).toBe(404);
    close();
  });
});

describe("Authorization", () => {
  it("returns 403 when a plain member tries to archive a project", async () => {
    const { app, db, orgId, projectId, close } = await setup();

    const { accessToken: bobToken, userId: bobId } = await loginTestUser(
      app,
      db,
      { email: "bob@example.com", password: "password123", displayName: "Bob" },
    );
    addMembership(db, orgId, bobId, "member");

    const res = await archive(app, bobToken, orgId, projectId);
    expect(res.status).toBe(403);
    close();
  });

  it("returns 403 when a plain member tries to restore an archived project", async () => {
    const { app, db, accessToken, orgId, projectId, close } = await setup();
    await archive(app, accessToken, orgId, projectId);

    const { accessToken: bobToken, userId: bobId } = await loginTestUser(
      app,
      db,
      { email: "bob@example.com", password: "password123", displayName: "Bob" },
    );
    addMembership(db, orgId, bobId, "member");

    const res = await restore(app, bobToken, orgId, projectId);
    expect(res.status).toBe(403);
    close();
  });
});

describe("deleting an archived project", () => {
  it("still succeeds", async () => {
    const { app, accessToken, orgId, projectId, close } = await setup();
    await archive(app, accessToken, orgId, projectId);
    const res = await app.request(
      `/organizations/${orgId}/projects/${projectId}`,
      { method: "DELETE", headers: auth(accessToken) },
    );
    expect(res.status).toBe(200);
    close();
  });
});
