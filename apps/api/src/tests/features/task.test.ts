import { describe, it, expect, beforeAll } from "vitest";
import { loginTestUser } from "../../db/test-utils.js";
import {
  auth,
  baseTask,
  setupTaskRouteTest as setup,
} from "./task-route-helpers.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

describe("POST /projects/:projectId/tasks", () => {
  it("creates a task and returns 201 with full dto", async () => {
    const { app, token, projectId, close } = await setup();
    const res = await app.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify(baseTask),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      title: string;
      column: string;
      tags: string[];
    };
    expect(body.title).toBe("Fix bug");
    expect(body.column).toBe("todo");
    expect(body.tags).toEqual([]);
    close();
  });

  it("returns 401 without auth", async () => {
    const { app, projectId, close } = await setup();
    const res = await app.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(baseTask),
    });
    expect(res.status).toBe(401);
    close();
  });

  it("returns 403 for non-member", async () => {
    const { app, db, projectId, close } = await setup();
    // Create Bob who is not in the project's org
    const { accessToken: bobToken } = await loginTestUser(app, db, {
      email: "bob@example.com",
      password: "password123",
      displayName: "Bob",
    });
    const res = await app.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { ...auth(bobToken), "Content-Type": "application/json" },
      body: JSON.stringify(baseTask),
    });
    expect(res.status).toBe(403);
    close();
  });
});

describe("GET /projects/:projectId/tasks", () => {
  it("returns 403 for non-member", async () => {
    const { app, db, projectId, close } = await setup();
    const { accessToken: bobToken } = await loginTestUser(app, db, {
      email: "bob@example.com",
      password: "password123",
      displayName: "Bob",
    });
    const res = await app.request(`/projects/${projectId}/tasks`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    expect(res.status).toBe(403);
    close();
  });

  it("returns list of tasks", async () => {
    const { app, token, projectId, close } = await setup();
    await app.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify({ ...baseTask, title: "T1" }),
    });
    await app.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify({ ...baseTask, title: "T2" }),
    });
    const res = await app.request(`/projects/${projectId}/tasks`, {
      headers: auth(token),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string }[];
    expect(body.length).toBe(2);
    close();
  });
});

describe("GET /projects/:projectId/tasks/:taskId", () => {
  it("returns the task", async () => {
    const { app, token, projectId, close } = await setup();
    const cr = await app.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify(baseTask),
    });
    const { id: taskId } = (await cr.json()) as { id: string };
    const res = await app.request(`/projects/${projectId}/tasks/${taskId}`, {
      headers: auth(token),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("Fix bug");
    close();
  });
});

describe("PATCH /projects/:projectId/tasks/:taskId", () => {
  it("updates the task title", async () => {
    const { app, token, projectId, close } = await setup();
    const cr = await app.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify(baseTask),
    });
    const { id: taskId } = (await cr.json()) as { id: string };
    const res = await app.request(`/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fixed" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("Fixed");
    close();
  });
});

describe("DELETE /projects/:projectId/tasks/:taskId", () => {
  it("deletes the task", async () => {
    const { app, token, projectId, close } = await setup();
    const cr = await app.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify(baseTask),
    });
    const { id: taskId } = (await cr.json()) as { id: string };
    const res = await app.request(`/projects/${projectId}/tasks/${taskId}`, {
      method: "DELETE",
      headers: auth(token),
    });
    expect(res.status).toBe(200);
    close();
  });
});

describe("GET /projects/:projectId/tasks/:taskId/history", () => {
  it("returns history after an update", async () => {
    const { app, token, projectId, close } = await setup();
    const cr = await app.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify(baseTask),
    });
    const { id: taskId } = (await cr.json()) as { id: string };
    await app.request(`/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await app.request(
      `/projects/${projectId}/tasks/${taskId}/history`,
      {
        headers: auth(token),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { field: string; oldValue: string }[];
    expect(body.length).toBe(1);
    expect(body[0]?.field).toBe("title");
    close();
  });
});
