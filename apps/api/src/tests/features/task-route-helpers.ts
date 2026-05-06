import { createApp } from "../../app.js";
import { createTestDb, loginTestUser } from "../../db/test-utils.js";

export const baseTask = {
  title: "Fix bug",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
};

export async function setupTaskRouteTest() {
  const testDb = createTestDb();
  const app = createApp(testDb.db);
  const { accessToken: token } = await loginTestUser(app, testDb.db, {
    email: "alice@example.com",
    password: "password123",
    displayName: "Alice",
  });
  const orgRes = await app.request("/organizations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Acme" }),
  });
  const { id: orgId } = (await orgRes.json()) as { id: string };
  const projRes = await app.request(`/organizations/${orgId}/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Sprint 1" }),
  });
  const { id: projectId } = (await projRes.json()) as { id: string };
  return { app, db: testDb.db, token, orgId, projectId, close: testDb.close };
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}
