import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, loginTestUser } from "../../db/test-utils.js";
import { createApp } from "../../app.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

async function setup() {
  const testDb = createTestDb();
  const app = createApp(testDb.db);
  const { accessToken: token } = await loginTestUser(app, testDb.db, {
    email: "alice@example.com",
    password: "pass",
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

  async function createTask(title = "Task") {
    const res = await app.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      }),
    });
    return (await res.json()) as {
      id: string;
      column: string;
      position: number;
      doer: null | { id: string };
    };
  }

  // Get alice's userId from a probe task reporter
  const t = await createTask("probe");
  const tRes = await app.request(`/projects/${projectId}/tasks/${t.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { reporter } = (await tRes.json()) as { reporter: { id: string } };
  const aliceId = reporter.id;

  return {
    app,
    token,
    orgId,
    projectId,
    createTask,
    aliceId,
    close: testDb.close,
  };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe("POST /projects/:projectId/tasks/:taskId/move", () => {
  it("moves task to a new column", async () => {
    const { app, token, projectId, createTask, close } = await setup();
    const task = await createTask();

    const res = await app.request(
      `/projects/${projectId}/tasks/${task.id}/move`,
      {
        method: "POST",
        headers: { ...auth(token), "Content-Type": "application/json" },
        body: JSON.stringify({ column: "done" }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { column: string };
    expect(body.column).toBe("done");
    close();
  });

  it("auto-assigns the actor as doer when moving to doing without a doer", async () => {
    const { app, token, projectId, createTask, close } = await setup();
    const task = await createTask();

    const res = await app.request(
      `/projects/${projectId}/tasks/${task.id}/move`,
      {
        method: "POST",
        headers: { ...auth(token), "Content-Type": "application/json" },
        body: JSON.stringify({ column: "doing" }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      column: string;
      doer: { id: string } | null;
    };
    expect(body.column).toBe("doing");
    expect(body.doer).not.toBeNull();
    close();
  });

  it("clears doer when moving from doing to todo", async () => {
    const { app, token, projectId, createTask, aliceId, close } = await setup();
    const task = await createTask();

    // Set doer first via update
    await app.request(`/projects/${projectId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify({ doerId: aliceId }),
    });

    // Move to doing (has doer now)
    await app.request(`/projects/${projectId}/tasks/${task.id}/move`, {
      method: "POST",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify({ column: "doing" }),
    });

    // Move back to todo — doer should be cleared
    const res = await app.request(
      `/projects/${projectId}/tasks/${task.id}/move`,
      {
        method: "POST",
        headers: { ...auth(token), "Content-Type": "application/json" },
        body: JSON.stringify({ column: "todo" }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { doer: null | object; column: string };
    expect(body.column).toBe("todo");
    expect(body.doer).toBeNull();
    close();
  });

  it("writes history for column change", async () => {
    const { app, token, projectId, createTask, close } = await setup();
    const task = await createTask();

    await app.request(`/projects/${projectId}/tasks/${task.id}/move`, {
      method: "POST",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify({ column: "done" }),
    });

    const histRes = await app.request(
      `/projects/${projectId}/tasks/${task.id}/history`,
      { headers: auth(token) },
    );
    const history = (await histRes.json()) as { field: string }[];
    expect(history.some((h) => h.field === "column")).toBe(true);
    close();
  });
});

describe("POST /projects/:projectId/tasks/:taskId/reorder", () => {
  it("updates the position", async () => {
    const { app, token, projectId, createTask, close } = await setup();
    const t1 = await createTask("T1");
    const t2 = await createTask("T2");

    // Reorder t2 between position 0 and t1.position (fractional: 0.5)
    const newPos = t1.position / 2;
    const res = await app.request(
      `/projects/${projectId}/tasks/${t2.id}/reorder`,
      {
        method: "POST",
        headers: { ...auth(token), "Content-Type": "application/json" },
        body: JSON.stringify({ position: newPos }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { position: number };
    expect(body.position).toBeCloseTo(newPos);
    close();
  });
});
