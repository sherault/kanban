import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, loginTestUser } from "../../db/test-utils.js";
import { createApp } from "../../app.js";
import { OrganizationService } from "../../features/organization/organization.service.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

async function setup() {
  const testDb = createTestDb();
  const app = createApp(testDb.db);
  const orgSvc = new OrganizationService(testDb.db);

  const { accessToken, userId } = await loginTestUser(app, testDb.db, {
    email: "owner@example.com",
    password: "password123",
    displayName: "Owner",
  });

  const org = orgSvc.createOrg(userId, { name: "Acme" });

  return { app, accessToken, orgId: org.id, close: testDb.close };
}

describe("POST /organizations/:orgId/invitations", () => {
  it("creates an invitation and returns InvitationTokenDto", async () => {
    const { app, accessToken, orgId, close } = await setup();
    const res = await app.request(`/organizations/${orgId}/invitations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      organizationId: string;
      expiresAt: string;
    };
    expect(body.organizationId).toBe(orgId);
    expect(typeof body.id).toBe("string");
    close();
  });
});

describe("GET /invite/:token", () => {
  it("returns org info for a valid token", async () => {
    const { app, accessToken, orgId, close } = await setup();
    const createRes = await app.request(`/organizations/${orgId}/invitations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { rawToken } = (await createRes.json()) as { rawToken: string };

    const res = await app.request(`/invite/${rawToken}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { organization: { id: string } };
    expect(body.organization.id).toBe(orgId);
    close();
  });

  it("returns 404 for unknown token", async () => {
    const { app, close } = await setup();
    const res = await app.request("/invite/nonexistent-token-abc");
    expect(res.status).toBe(404);
    close();
  });
});

describe("POST /invite/:token", () => {
  it("registers a new user and joins the org", async () => {
    const { app, accessToken, orgId, close } = await setup();
    const createRes = await app.request(`/organizations/${orgId}/invitations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { rawToken } = (await createRes.json()) as { rawToken: string };

    const res = await app.request(`/invite/${rawToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "newbie@example.com",
        password: "password123",
        displayName: "Newbie",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      user: { email: string };
      accessToken: string;
    };
    expect(body.user.email).toBe("newbie@example.com");
    expect(typeof body.accessToken).toBe("string");
    close();
  });

  it("returns 404 for a token already used", async () => {
    const { app, accessToken, orgId, close } = await setup();
    const createRes = await app.request(`/organizations/${orgId}/invitations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { rawToken } = (await createRes.json()) as { rawToken: string };

    await app.request(`/invite/${rawToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "first@example.com",
        password: "password123",
        displayName: "First",
      }),
    });

    const res = await app.request(`/invite/${rawToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "second@example.com",
        password: "password123",
        displayName: "Second",
      }),
    });
    expect(res.status).toBe(404);
    close();
  });
});
