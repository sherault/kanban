import { describe, it, expect, beforeAll } from "vitest";
import { auth, baseTask, setupTaskRouteTest } from "./task-route-helpers.js";

beforeAll(() => {
  process.env["JWT_SECRET"] = "test-jwt-secret-must-be-at-least-32-chars!!";
  process.env["NODE_ENV"] = "test";
});

async function setup() {
  const ctx = await setupTaskRouteTest();
  const json = { ...auth(ctx.token), "Content-Type": "application/json" };
  const targetRes = await ctx.app.request(
    `/organizations/${ctx.orgId}/projects`,
    { method: "POST", headers: json, body: JSON.stringify({ name: "Target" }) },
  );
  const { id: targetProjectId } = (await targetRes.json()) as { id: string };
  const taskRes = await ctx.app.request(`/projects/${ctx.projectId}/tasks`, {
    method: "POST",
    headers: json,
    body: JSON.stringify(baseTask),
  });
  const task = (await taskRes.json()) as { id: string };
  return { ...ctx, json, targetProjectId, task };
}

describe("POST /projects/:projectId/tasks/:taskId/transfer", () => {
  it("transfers the task and returns it in the target project", async () => {
    const { app, json, projectId, targetProjectId, task, close } =
      await setup();

    const res = await app.request(
      `/projects/${projectId}/tasks/${task.id}/transfer`,
      {
        method: "POST",
        headers: json,
        body: JSON.stringify({ targetProjectId }),
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; projectId: string };
    expect(body.id).toBe(task.id);
    expect(body.projectId).toBe(targetProjectId);
    close();
  });

  it("answers 404 when the task is not in the project of the path", async () => {
    const { app, json, targetProjectId, task, close } = await setup();

    const res = await app.request(
      `/projects/${targetProjectId}/tasks/${task.id}/transfer`,
      {
        method: "POST",
        headers: json,
        body: JSON.stringify({ targetProjectId }),
      },
    );

    expect(res.status).toBe(404);
    close();
  });

  it("answers 422 when the target is the task's own project", async () => {
    const { app, json, projectId, task, close } = await setup();

    const res = await app.request(
      `/projects/${projectId}/tasks/${task.id}/transfer`,
      {
        method: "POST",
        headers: json,
        body: JSON.stringify({ targetProjectId: projectId }),
      },
    );

    expect(res.status).toBe(422);
    close();
  });

  it("answers 400 without a targetProjectId", async () => {
    const { app, json, projectId, task, close } = await setup();

    const res = await app.request(
      `/projects/${projectId}/tasks/${task.id}/transfer`,
      { method: "POST", headers: json, body: JSON.stringify({}) },
    );

    expect(res.status).toBe(400);
    close();
  });
});
